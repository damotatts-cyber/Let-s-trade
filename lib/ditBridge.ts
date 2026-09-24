export const DIT_Bridge = {
  async execute(payload: unknown): Promise<{ success: boolean }> {
    void payload;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { success: true };
  },
};
