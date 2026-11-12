export function ProviderIcon({
  provider,
  size = 16,
}: {
  provider: string;
  size?: number;
}) {
  return (
    <img
      src={`https://unpkg.com/@lobehub/icons-static-png@latest/light/${provider}-color.png`}
      alt={provider}
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
    />
  );
}