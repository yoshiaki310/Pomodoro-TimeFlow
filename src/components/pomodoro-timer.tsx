"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings, Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import * as Tone from 'tone';

const DEFAULT_FOCUS_DURATION = 30; // minutes
const DEFAULT_BREAK_DURATION = 15; // minutes

export default function PomodoroTimer() {
  const [focusDuration, setFocusDuration] = useState(DEFAULT_FOCUS_DURATION);
  const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK_DURATION);
  
  const [customFocusDuration, setCustomFocusDuration] = useState(DEFAULT_FOCUS_DURATION.toString());
  const [customBreakDuration, setCustomBreakDuration] = useState(DEFAULT_BREAK_DURATION.toString());

  const [timeLeft, setTimeLeft] = useState(focusDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<"focus" | "break">("focus");
  const [totalFocusedSeconds, setTotalFocusedSeconds] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { toast } = useToast();
  const audioContextStarted = useRef(false);
  const alarmSynth = useRef<Tone.Synth | null>(null);

  const initializeAudio = useCallback(async () => {
    if (!audioContextStarted.current && Tone.context.state !== "running") {
      await Tone.start();
      audioContextStarted.current = true;
      console.log("Audio context started");
    }
    if (!alarmSynth.current) {
      alarmSynth.current = new Tone.Synth().toDestination();
    }
  }, []);


  useEffect(() => {
    if (typeof window !== "undefined") {
      initializeAudio();
    }
  }, [initializeAudio]);

  const playAlarm = useCallback(() => {
    if (alarmSynth.current && Tone.context.state === "running") {
      alarmSynth.current.triggerAttackRelease("C5", "0.5s", Tone.now());
      alarmSynth.current.triggerAttackRelease("G5", "0.5s", Tone.now() + 0.7);
    } else {
      console.warn("Alarm sound could not be played. Audio context not running or synth not initialized.");
      initializeAudio(); // Try to re-initialize
    }
  }, [initializeAudio]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      playAlarm();
      if (currentPhase === "focus") {
        setTotalFocusedSeconds((prev) => prev + focusDuration * 60);
        setCurrentPhase("break");
        setTimeLeft(breakDuration * 60);
        toast({ title: "Focus Time Over!", description: "Time for a break.", variant: "default" });
      } else {
        setCurrentPhase("focus");
        setTimeLeft(focusDuration * 60);
        toast({ title: "Break Time Over!", description: "Back to focus!", variant: "default" });
      }
      // Auto-continue to next phase
      // setIsActive(true); // This is implicitly handled as isActive remains true
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, currentPhase, focusDuration, breakDuration, toast, playAlarm]);

  const handleStartPause = async () => {
    await initializeAudio(); // Ensure audio is ready before starting
    setIsActive((prev) => !prev);
    if (!isActive && timeLeft === 0) { // Starting for the first time or after a reset that set timeLeft to 0
        setTimeLeft(currentPhase === "focus" ? focusDuration * 60 : breakDuration * 60);
    }
  };

  const handleReset = () => {
    setIsActive(false);
    setCurrentPhase("focus");
    setTimeLeft(focusDuration * 60);
    // Optionally reset total focused time: setTotalFocusedSeconds(0);
    toast({ title: "Timer Reset", description: "Ready to start a new focus session." });
  };

  const handleSkip = async () => {
    await initializeAudio();
    playAlarm();
    if (currentPhase === "focus") {
      setTotalFocusedSeconds((prev) => prev + (focusDuration * 60 - timeLeft)); // Add elapsed focus time
      setCurrentPhase("break");
      setTimeLeft(breakDuration * 60);
      toast({ title: "Skipped to Break", description: "Enjoy your break!", variant: "default" });
    } else {
      setCurrentPhase("focus");
      setTimeLeft(focusDuration * 60);
      toast({ title: "Skipped to Focus", description: "Time to focus!", variant: "default" });
    }
    setIsActive(true); // Auto-start next phase
  };

  const handleSaveSettings = () => {
    const newFocus = parseInt(customFocusDuration, 10);
    const newBreak = parseInt(customBreakDuration, 10);

    if (isNaN(newFocus) || newFocus <= 0 || isNaN(newBreak) || newBreak <= 0) {
      toast({ title: "Invalid Input", description: "Durations must be positive numbers.", variant: "destructive" });
      return;
    }

    setFocusDuration(newFocus);
    setBreakDuration(newBreak);

    if (!isActive) {
      if (currentPhase === "focus") {
        setTimeLeft(newFocus * 60);
      } else {
        setTimeLeft(newBreak * 60);
      }
    }
    setIsSettingsOpen(false);
    toast({ title: "Settings Saved", description: `Focus: ${newFocus} min, Break: ${newBreak} min.` });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatTotalFocusedTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(" ");
  };

  const currentPhaseTotalDuration = (currentPhase === "focus" ? focusDuration : breakDuration) * 60;
  const progressPercentage = currentPhaseTotalDuration > 0 ? ((currentPhaseTotalDuration - timeLeft) / currentPhaseTotalDuration) * 100 : 0;

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-headline text-3xl">Pomodoro TimeFlow</CardTitle>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => {
                setCustomFocusDuration(focusDuration.toString());
                setCustomBreakDuration(breakDuration.toString());
              }}>
                <Settings className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-headline">Timer Settings</DialogTitle>
                <DialogDescription>
                  Set your desired focus and break durations in minutes.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="focus-duration" className="text-right">
                    Focus
                  </Label>
                  <Input
                    id="focus-duration"
                    type="number"
                    value={customFocusDuration}
                    onChange={(e) => setCustomFocusDuration(e.target.value)}
                    className="col-span-3"
                    min="1"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="break-duration" className="text-right">
                    Break
                  </Label>
                  <Input
                    id="break-duration"
                    type="number"
                    value={customBreakDuration}
                    onChange={(e) => setCustomBreakDuration(e.target.value)}
                    className="col-span-3"
                    min="1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button type="submit" onClick={handleSaveSettings}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 py-8">
          <div className="text-center">
            <p className="text-xl font-medium text-primary mb-2">
              {currentPhase === "focus" ? "Focus Time" : "Break Time"}
            </p>
            <h2 className="text-7xl font-bold text-accent font-mono tabular-nums tracking-tight">
              {formatTime(timeLeft)}
            </h2>
          </div>
          <Progress value={progressPercentage} className="w-full h-3 transition-all duration-500" />
          <div className="flex space-x-4">
            <Button onClick={handleStartPause} size="lg" className="px-8 py-6 text-lg w-36">
              {isActive ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
              {isActive ? "Pause" : "Start"}
            </Button>
            <Button onClick={handleReset} variant="outline" size="lg" className="px-6 py-6 text-lg">
              <RotateCcw className="mr-2 h-5 w-5" /> Reset
            </Button>
            <Button onClick={handleSkip} variant="secondary" size="lg" className="px-6 py-6 text-lg">
              <SkipForward className="mr-2 h-5 w-5" /> Skip
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center text-muted-foreground">
          <p>Total Focused Time: {formatTotalFocusedTime(totalFocusedSeconds)}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
