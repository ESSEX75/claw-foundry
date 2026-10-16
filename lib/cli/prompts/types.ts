/** Defines the terminal question capability consumed by setup binding selection. */

/** Minimal question interface satisfied by the interactive session's readline owner. */
export type TerminalQuestion = {
  /** Collect one operator response without owning or closing the terminal session.
   * @param prompt - Question text including the offered default selection.
   */
  question(prompt: string): Promise<string>;
};
