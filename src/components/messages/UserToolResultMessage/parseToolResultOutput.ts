import type { Tool } from '../../../Tool.js'

export function validateToolResultOutput(
  tool: Tool,
  toolUseResult: unknown,
): { success: true; output: unknown } | { success: false } {
  const parsedOutput = tool.outputSchema?.safeParse(toolUseResult)
  if (parsedOutput && !parsedOutput.success) {
    return { success: false }
  }
  return {
    success: true,
    output: parsedOutput?.data ?? toolUseResult,
  }
}

export function parseToolResultOutput(
  tool: Tool,
  toolUseResult: unknown,
): unknown {
  const validated = validateToolResultOutput(tool, toolUseResult)
  return validated.success ? validated.output : toolUseResult
}
