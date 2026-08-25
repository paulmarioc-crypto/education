export const env = {
  port: Number(process.env.PORT ?? 4000),
  groqApiKey: process.env.GROQ_API_KEY ?? "",
};
