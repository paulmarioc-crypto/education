function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}. Copy server/.env.example to server/.env and fill it in.`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  pin: required("MEDSTUDY_PIN"),
  sessionSecret: required("MEDSTUDY_SESSION_SECRET"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
};
