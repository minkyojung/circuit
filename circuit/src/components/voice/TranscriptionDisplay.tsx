import React from 'react'
import { useVoice } from '@/contexts/VoiceContext'
import { cn } from '@/lib/utils'

interface TranscriptionDisplayProps {
  className?: string
}

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ className }) => {
  const { inputState } = useVoice()
  const { finalTranscription, partialTranscription, confidence, isRecording } = inputState

  if (!isRecording && !finalTranscription) {
    return null
  }

  return (
    <div className={cn('p-4 bg-muted rounded-lg', className)}>
      {isRecording && (
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Recording...</span>
          </div>
        </div>
      )}

      {partialTranscription && (
        <div className="text-sm text-muted-foreground italic mb-2">
          {partialTranscription}
        </div>
      )}

      {finalTranscription && (
        <div>
          <div className="text-foreground font-medium">
            {finalTranscription}
          </div>
          {confidence > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              Confidence: {(confidence * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}
    </div>
  )
}
