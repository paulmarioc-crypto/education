export const env = {
  port: Number(process.env.PORT ?? 4000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
};
