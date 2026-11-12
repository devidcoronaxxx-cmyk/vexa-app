--!nonstrict
--[[
  Vexa Studio Connector
  =====================
  Local companion plugin for the Vexa app. It turns a running Roblox Studio
  session into a first-class target for the Vexa bridge WITHOUT depending on
  Roblox's built-in "Studio as MCP server" toggle, authentication or the
  StudioMCP.exe handshake.

  How it works:
    1. On load / "Connect" it POSTs to the bridge (127.0.0.1:8765) and gets a
       token + instanceId.
    2. It polls GET /api/studio/pop for pending commands (apply generation,
       execute_luau, selection, verify...).
    3. Commands are executed in the plugin context via loadstring (same
       mechanism the official Studio MCP uses) and reported back via
       POST /api/studio/report.

  It runs on loopback only.
]]

local PLUGIN_NAME = "Vexa"
local BRIDGE_URL = "http://127.0.0.1:8765"
local HEARTBEAT_MAX_GAP = 20 -- seconds before the bridge forgets this instance

local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

-- Persistent identity so the bridge keeps the same instance across re-registers.
local token = plugin:GetSetting("token") or ""
local instanceId = plugin:GetSetting("instanceId") or ""

local connectionActive = false
local pollMs = 800
local reconnectMs = 1500

-- Runtime QA harvesting: after Play, the in-game probe writes
-- ServerStorage.VexaQA.Report and this plugin forwards each new runId to the
-- bridge, so QA reports arrive even when the game has HTTP disabled.
local lastHarvestAt = 0
local seenReports = {}

local toolbar = plugin:CreateToolbar(PLUGIN_NAME)
local toggleButton = toolbar:CreateButton(
  "Connettore Studio",
  "Collega/discollega Vexa da questo Studio",
  ""
)
toggleButton:SetActive(connectionActive)

local dock = plugin:CreateDockWidgetPluginGui(
  "VexaConnector",
  DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, false, false, 280, 170, 280, 170)
)
dock.Title = "Vexa"
dock.Name = "VexaConnector"

local root = Instance.new("ScreenGui")
root.Name = "VexaConnectorUI"
root.IgnoreGuiInset = true
root.ResetOnSpawn = false
root.Parent = dock

local frame = Instance.new("Frame")
frame.Size = UDim2.fromScale(1, 1)
frame.BackgroundColor3 = Color3.fromRGB(22, 26, 34)
frame.BorderSizePixel = 0
frame.Parent = root

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 26)
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBold
title.Text = "Vexa · Collegamento Studio"
title.TextColor3 = Color3.fromRGB(235, 235, 235)
title.TextSize = 14
title.Parent = frame

local status = Instance.new("TextLabel")
status.Position = UDim2.new(0, 8, 0, 30)
status.Size = UDim2.new(1, -16, 0, 42)
status.BackgroundTransparency = 1
status.TextWrapped = true
status.Font = Enum.Font.Gotham
status.Text = "Avvio..."
status.TextColor3 = Color3.fromRGB(200, 200, 200)
status.TextSize = 12
status.Parent = frame

local hint = Instance.new("TextLabel")
hint.Position = UDim2.new(0, 8, 0, 118)
hint.Size = UDim2.new(1, -16, 0, 28)
hint.BackgroundTransparency = 1
hint.TextWrapped = true
hint.Font = Enum.Font.Gotham
hint.Text = "Si collega in locale a 127.0.0.1:8765 (bridge Vexa)."
hint.TextColor3 = Color3.fromRGB(150, 150, 150)
hint.TextSize = 10
hint.Parent = frame

local action = Instance.new("TextButton")
action.Position = UDim2.new(0, 12, 0, 76)
action.Size = UDim2.new(1, -24, 0, 36)
action.AutoButtonColor = true
action.Font = Enum.Font.GothamBold
action.BackgroundColor3 = Color3.fromRGB(45, 120, 90)
action.TextColor3 = Color3.fromRGB(255, 255, 255)
action.Text = "Connetti"
action.TextSize = 14
action.Parent = frame

local function setStatus(text, ok, isError)
  ok = ok ~= false
  status.Text = text
  status.TextColor3 = (isError and Color3.fromRGB(235, 100, 100)) or (ok and Color3.fromRGB(140, 220, 170)) or Color3.fromRGB(230, 200, 100)
  print("[Vexa] " .. text)
end

-- ---------------------------------------------------------------------------
-- HTTP helpers
-- ---------------------------------------------------------------------------

local function postJSON(url, payload)
  local res = HttpService:RequestAsync({
    Url = url,
    Method = "POST",
    Headers = { ["Content-Type"] = "application/json", ["Accept"] = "application/json" },
    Body = HttpService:JSONEncode(payload),
    Timeout = 6,
  })
  if res.StatusCode < 200 or res.StatusCode >= 300 then
    error("HTTP " .. tostring(res.StatusCode) .. ": " .. tostring(res.Body))
  end
  return HttpService:JSONDecode(res.Body)
end

local function getJSON(url)
  local res = HttpService:RequestAsync({
    Url = url,
    Method = "GET",
    Headers = { ["Accept"] = "application/json" },
    Timeout = 4,
  })
  if res.StatusCode < 200 or res.StatusCode >= 300 then
    error("HTTP " .. tostring(res.StatusCode) .. ": " .. tostring(res.Body))
  end
  return HttpService:JSONDecode(res.Body)
end

-- ---------------------------------------------------------------------------
-- Registration / heartbeat
-- ---------------------------------------------------------------------------

local function register()
  local placeName = "Unknown"
  pcall(function()
    placeName = tostring(game.Name or "")
  end)
  local payload = {
    name = "Roblox Studio",
    instanceId = instanceId,
    token = token,
placeId = tostring(game.PlaceId or 0),
    placeName = placeName,
    pluginVersion = "1.6.0",
    capabilities = { "exec", "qa" },
  }
  local res = postJSON(BRIDGE_URL .. "/api/studio/register", payload)
  local newToken = tostring(res.token or "")
  local newId = tostring(res.instanceId or "")
  if newToken ~= "" then
    token = newToken
    plugin:SetSetting("token", token)
  end
  if newId ~= "" then
    instanceId = newId
    plugin:SetSetting("instanceId", instanceId)
  end
  pollMs = tonumber(res.pollMs) or 800
  setStatus("Connesso · " .. placeName)
  toggleButton:SetActive(true)
  action.Text = "Disconnetti"
  action.BackgroundColor3 = Color3.fromRGB(150, 60, 60)
end

-- ---------------------------------------------------------------------------
-- Command execution
-- ---------------------------------------------------------------------------

local function formatReturnValue(val)
  if type(val) == "string" then return val end
  if val == nil then return "" end
  if type(val) == "table" then
    local ok, json = pcall(function() return HttpService:JSONEncode(val) end)
    if ok then return json end
  end
  return tostring(val)
end

local function executeLuau(code)
  local fn, compileErr = loadstring(code)
  if not fn then return false, "Luau compile error: " .. tostring(compileErr) end
  local ok, result = pcall(fn)
  if not ok then return false, "Luau runtime error: " .. tostring(result) end
  return true, formatReturnValue(result)
end

local function runCommand(cmd)
  if type(cmd) ~= "table" or not cmd then return end
  local yang, yerr = pcall(function()
    local code = tostring(cmd.code or "")
    local ok, result = executeLuau(code)
    local report = { token = token, id = tostring(cmd.id or ""), ok = ok }
    if ok then
      report.result = result
    else
      report.error = result
    end
    local okReport = pcall(function()
      postJSON(BRIDGE_URL .. "/api/studio/report", report)
    end)
    if not okReport then
      setStatus("Report fallito: ponte non raggiungibile", false, true)
    end
  end)
  if not yang then
    setStatus("runCommand err: " .. tostring(yerr), false, true)
  end
end

-- ---------------------------------------------------------------------------
-- Polling loop
-- ---------------------------------------------------------------------------

local activeTicker = false

local function harvestQa()
  local tickNow = os.clock()
  if tickNow - lastHarvestAt < 2 then return end
  lastHarvestAt = tickNow
  local ok, stored = pcall(function()
    local ss = game:GetService("ServerStorage")
    local folder = ss:FindFirstChild("VexaQA")
    if not folder then return nil end
    local r = folder:FindFirstChild("Report")
    if r and r:IsA("StringValue") then return r end
    return nil
  end)
  if not ok or not stored then return end
  local text = tostring(stored.Value or "")
  if text == "" then return end
  local okParse, parsed = pcall(function() return HttpService:JSONDecode(text) end)
  if not okParse or type(parsed) ~= "table" then return end
  local rid = tostring(parsed.runId or "")
  if rid == "" or seenReports[rid] then return end
  seenReports[rid] = true
  local n = 0
  for _ in pairs(seenReports) do n = n + 1 end
  if n > 40 then seenReports = {} seenReports[rid] = true end
  pcall(function()
    postJSON(BRIDGE_URL .. "/api/studio/qa", {
      token = token,
      report = parsed,
      source = "plugin",
    })
  end)
end

local function pollOnce()
  local payload = getJSON(BRIDGE_URL .. "/api/studio/pop?token=" .. HttpService:UrlEncode(token))
  local cmd = payload and payload.command
  if cmd and type(cmd) == "table" and cmd.tool == "exec" then
    runCommand(cmd)
  end
end

local function tick()
  pcall(function()
    if not connectionActive then
      activeTicker = false
      return
    end
    local didWork, err = pcall(pollOnce)
    pcall(harvestQa)
    if not didWork then
      local message = tostring(err)
      if string.find(message, "404")
        or string.find(message, "401")
        or string.find(message, "HttpServiceHttpFailure")
        or string.find(message, "HttpServiceRequestError")
        or string.find(message, "HttpServiceTimedOut") then
        setStatus("Ponte non raggiungibile, riprovo...", false, true)
        pcall(function()
          register()
        end)
      end
    else
      reconnectMs = 1500
    end
  end)
  if activeTicker then
    task.delay(pollMs / 1000, tick)
  end
end

local function connect()
  if connectionActive then return end
  connectionActive = true
  toggleButton:SetActive(true)
  local ok, err = pcall(register)
  if not ok then
    setStatus("Connessione fallita: " .. tostring(err), false, true)
  end
  if activeTicker == false then
    activeTicker = true
    task.spawn(tick)
  end
end

local function disconnect()
  connectionActive = false
  toggleButton:SetActive(false)
  setStatus("Disconnesso. Premi Connetti per ricollegare.", false)
  action.Text = "Connetti"
  action.BackgroundColor3 = Color3.fromRGB(45, 120, 90)
end

action.MouseButton1Click:Connect(function()
  if connectionActive then disconnect() else connect() end
end)

toggleButton.Click:Connect(function()
  if connectionActive then disconnect() else connect() end
end)

plugin.Unloading:Connect(function()
  connectionActive = false
end)

-- Auto-connect on load: retry until the bridge appears (or 2 minutes).
task.spawn(function()
  for _ = 1, 60 do
    if connectionActive then break end
    local ok = pcall(function()
      local payload = getJSON(BRIDGE_URL .. "/health")
      return payload and payload.ok
    end)
    if ok then
      connect()
      break
    end
    setStatus("In attesa del ponte Vexa...", false)
    task.wait(2)
  end
end)