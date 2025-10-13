"use client"

import * as React from "react"
import { Play, Pause, Volume2, VolumeX, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const DEFAULT_SOURCE = "https://download.samplelib.com/mp3/sample-3s.mp3"
const SPEED_OPTIONS: number[] = [0.75, 1, 1.25, 1.5, 2]

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "00:00"
  }
  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remaining = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`
}

export interface MP3PlayerProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  title?: string
  preload?: "auto" | "metadata" | "none"
  autoPlay?: boolean
  loop?: boolean
}

export const MP3Player: React.FC<MP3PlayerProps> = ({
  src = DEFAULT_SOURCE,
  title,
  preload = "metadata",
  autoPlay = false,
  loop = false,
  className,
  style,
  ...rest
}) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const seekingRef = React.useRef(false)
  const [isReady, setIsReady] = React.useState(false)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [duration, setDuration] = React.useState(0)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [volume, setVolume] = React.useState(0.75)
  const [playbackRate, setPlaybackRate] = React.useState(1)
  const sourceLabel = React.useMemo(() => {
    if (!src) {
      return ""
    }
    try {
      const url = new URL(src, typeof window !== "undefined" ? window.location.href : undefined)
      const pathPart = url.pathname.split("/").filter(Boolean).pop()
      return pathPart ? pathPart : url.hostname
    } catch {
      return src
    }
  }, [src])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      setCurrentTime(audio.currentTime)
      setIsReady(true)
    }
    const handleTimeUpdate = () => {
      if (seekingRef.current) return
      setCurrentTime(audio.currentTime)
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(audio.loop ? 0 : audio.duration)
    }

    audio.addEventListener("loadedmetadata", handleLoaded)
    audio.addEventListener("canplay", handleLoaded)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)

    if (audio.readyState >= 2) {
      handleLoaded()
    }

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoaded)
      audio.removeEventListener("canplay", handleLoaded)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [src])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = playbackRate
  }, [playbackRate])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.loop = loop
  }, [loop])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.pause()
    audio.currentTime = 0
    setCurrentTime(0)
    setIsReady(false)
    const playPromise = autoPlay ? audio.play() : undefined
    if (playPromise) {
      playPromise.catch(() => setIsPlaying(false))
    } else {
      setIsPlaying(false)
    }
  }, [src, autoPlay])

  const handleTogglePlayback = React.useCallback(() => {
    const audio = audioRef.current
    if (!audio || !isReady) return

    if (isPlaying) {
      audio.pause()
      return
    }

    const playPromise = audio.play()
    if (playPromise) {
      playPromise.catch((error) => {
        console.warn("[MP3Player] Failed to start playback", error)
      })
    }
  }, [isPlaying, isReady])

  const handleProgressChange = React.useCallback((value: number[]) => {
    if (!value || value.length === 0) return
    const next = value[0]
    seekingRef.current = true
    setCurrentTime(next)
  }, [])

  const handleProgressCommit = React.useCallback((value: number[]) => {
    const audio = audioRef.current
    if (!audio || !value || value.length === 0) return
    const next = value[0]
    audio.currentTime = next
    seekingRef.current = false
    setCurrentTime(next)
  }, [])

  const handleVolumeChange = React.useCallback((value: number[]) => {
    if (!value || value.length === 0) return
    const next = value[0] / 100
    setVolume(Math.min(Math.max(next, 0), 1))
  }, [])

  const handleSpeedChange = React.useCallback((value: number) => {
    setPlaybackRate(value)
  }, [])

  const volumeIcon = volume <= 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />

  return (
    <div
      className={cn(
        "flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm",
        "backdrop-blur supports-[backdrop-filter]:bg-card/90",
        className,
      )}
      style={style}
      {...rest}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs uppercase text-muted-foreground">Now Playing</span>
          <span className="text-sm font-medium text-foreground">
            {title ?? "Sample Track"}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SPEED_OPTIONS.map((option) => (
              <DropdownMenuItem key={option} onClick={() => handleSpeedChange(option)} className="flex items-center justify-between">
                <span>{option.toFixed(2)}x</span>
                {option === playbackRate ? <span className="text-primary text-xs">Active</span> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={handleTogglePlayback}
          disabled={!isReady}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-start text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>{`${formatTime(currentTime)} / ${formatTime(duration)}`}</span>
          </div>
          <Slider
            min={0}
            max={duration || 0}
            step={0.1}
            value={[Math.min(currentTime, duration || 0)]}
            onValueChange={handleProgressChange}
            onValueCommit={handleProgressCommit}
            disabled={!isReady || duration === 0}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              {volumeIcon}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44" align="center" side="top">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Volume</span>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[Math.round(volume * 100)]}
                onValueChange={handleVolumeChange}
              />
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex flex-1 flex-col gap-1 text-right text-[11px] text-muted-foreground">
          <span>Speed: {playbackRate.toFixed(2)}x</span>
          <span>Source: {sourceLabel || "Default"}</span>
        </div>
      </div>

      <audio ref={audioRef} src={src} preload={preload} autoPlay={autoPlay} />
    </div>
  )
}

MP3Player.displayName = "MP3Player"
