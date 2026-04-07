import * as React from 'react'
import { Box, Text } from '@anthropic/ink'
import { formatNumber } from '../utils/format.js'
import type { Theme } from '../utils/theme.js'

type Props = {
  agentType: string
  description?: string
  name?: string
  descriptionColor?: keyof Theme
  taskDescription?: string
  toolUseCount: number
  tokens: number | null
  color?: keyof Theme
  isLast: boolean
  isResolved: boolean
  isError: boolean
  isAsync?: boolean
  shouldAnimate: boolean
  lastToolInfo?: string | null
  hideType?: boolean
}

export function AgentProgressLine({
  agentType,
  description,
  name,
  descriptionColor,
  taskDescription,
  toolUseCount,
  tokens,
  color,
  isLast,
  isResolved,
  isError: _isError,
  isAsync = false,
  shouldAnimate: _shouldAnimate,
  lastToolInfo,
  hideType = false,
}: Props): React.ReactNode {
  const treeChar = isLast ? '└─' : '├─'
  const isBackgrounded = isAsync && isResolved
  const headerLabel = hideType ? (name ?? description ?? agentType) : agentType
  const statsText = !isBackgrounded
    ? `${toolUseCount} tool ${toolUseCount === 1 ? 'use' : 'uses'}${tokens !== null ? ` · ${formatNumber(tokens)} tokens` : ''}`
    : null

  const getStatusText = (): string => {
    if (!isResolved) {
      return lastToolInfo || 'Initializing…'
    }
    if (isBackgrounded) {
      return taskDescription ?? 'Running in the background'
    }
    return 'Done'
  }

  return (
    <Box flexDirection="column" width="100%">
      <Box paddingLeft={3} width="100%" flexDirection="row">
        <Text dimColor>{treeChar} </Text>
        <Box flexDirection="row" flexGrow={1} flexShrink={1} minWidth={0}>
          <Box flexShrink={1} minWidth={0}>
            <Text
              bold
              wrap="truncate-end"
              backgroundColor={!hideType ? color : undefined}
              color={!hideType && color ? 'inverseText' : undefined}
            >
              {headerLabel}
            </Text>
          </Box>
          {hideType && name && description ? (
            <Box flexShrink={1} minWidth={0}>
              <Text dimColor wrap="truncate-end">
                : {description}
              </Text>
            </Box>
          ) : !hideType && description ? (
            <Box flexShrink={1} minWidth={0}>
              <Text dimColor wrap="truncate-end">
                {' ('}
                <Text
                  backgroundColor={descriptionColor}
                  color={descriptionColor ? 'inverseText' : undefined}
                >
                  {description}
                </Text>
                {')'}
              </Text>
            </Box>
          ) : null}
          {statsText ? (
            <Box flexShrink={1} minWidth={0}>
              <Text dimColor wrap="truncate-end">
                {' · '}
                {statsText}
              </Text>
            </Box>
          ) : null}
        </Box>
      </Box>
      {!isBackgrounded && (
        <Box paddingLeft={3} flexDirection="row" width="100%">
          <Text dimColor>{isLast ? '   ⎿  ' : '│  ⎿  '}</Text>
          <Box flexGrow={1} flexShrink={1} minWidth={0}>
            <Text dimColor wrap="truncate-end">
              {getStatusText()}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
