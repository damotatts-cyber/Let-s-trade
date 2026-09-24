export const DIT_Bridge = {
  async execute(_payload: unknown): Promise<{ success: boolean }> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { success: true };
  },
};
