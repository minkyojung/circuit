import React from 'react'
import { Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useVoice } from '@/contexts/VoiceContext'

interface VoiceButtonProps {
  className?: string
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  className,
  size = 'default',
  variant = 'outline'
}) => {
  const { inputState, startRecording, stopRecording, cancelRecording } = useVoice()
  const { isRecording, recordingDuration } = inputState

  const handleClick = async () => {
    if (isRecording) {
      await stopRecording()
    } else {
      await startRecording()
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes + ':' + remainingSeconds.toString().padStart(2, '0')
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isRecording ? 'default' : variant}
        size={size}
        onClick={handleClick}
        className={cn(
          'relative',
          isRecording && 'bg-red-500 hover:bg-red-600 animate-pulse',
          className
        )}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <>
            <MicOff className="h-4 w-4 mr-2" />
            {formatDuration(recordingDuration)}
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            <span className="ml-2">Voice</span>
          </>
        )}
      </Button>

      {isRecording && (
        <Button
          variant="ghost"
          size="sm"
          onClick={cancelRecording}
          title="Cancel recording"
        >
          Cancel
        </Button>
      )}
    </div>
  )
}
