
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Settings, Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import * as Tone from 'tone';

const DEFAULT_FOCUS_DURATION = 30; 
const DEFAULT_BREAK_DURATION = 15; 
const DEFAULT_ALARM_VOLUME = 50; // Default volume percentage (0-100)

export default function PomodoroTimer() {
  const [focusDuration, setFocusDuration] = useState(DEFAULT_FOCUS_DURATION);
  const [breakDuration, setBreakDuration] = useState(DEFAULT_BREAK_DURATION);
  const [alarmVolume, setAlarmVolume] = useState(DEFAULT_ALARM_VOLUME);
  
  const [customFocusDuration, setCustomFocusDuration] = useState(DEFAULT_FOCUS_DURATION.toString());
  const [customBreakDuration, setCustomBreakDuration] = useState(DEFAULT_BREAK_DURATION.toString());
  const [customAlarmVolume, setCustomAlarmVolume] = useState(DEFAULT_ALARM_VOLUME.toString());

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
      console.log("オーディオコンテキストが開始されました");
    }
    if (!alarmSynth.current) {
      alarmSynth.current = new Tone.Synth().toDestination();
    }
  }, []);

  useEffect(() => {
    if (alarmSynth.current && audioContextStarted.current && Tone.context.state === "running") {
      const newDbVolume = alarmVolume === 0 ? -Infinity : Tone.gainToDb(alarmVolume / 100);
      alarmSynth.current.volume.value = newDbVolume;
    }
  }, [alarmVolume]);


  useEffect(() => {
    if (typeof window !== "undefined") {
      initializeAudio();
    }
  }, [initializeAudio]);

  const playAlarm = useCallback(async () => {
    await initializeAudio();
    if (alarmSynth.current && Tone.context.state === "running") {
      const now = Tone.now();
      // メロディ: C5(8分音符), E5(8分音符), G5(8分音符), C6(4分音符)
      // "c8e8g8>c4<" の解釈
      const eighthNoteTime = Tone.Time("8n").toSeconds();
      alarmSynth.current.triggerAttackRelease("C5", "8n", now);
      alarmSynth.current.triggerAttackRelease("E5", "8n", now + eighthNoteTime);
      alarmSynth.current.triggerAttackRelease("G5", "8n", now + eighthNoteTime * 2);
      alarmSynth.current.triggerAttackRelease("C6", "4n", now + eighthNoteTime * 3);
    } else {
      console.warn("アラーム音を再生できませんでした。オーディオコンテキストが実行されていないか、シンセサイザーが初期化されていません。");
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
        toast({ title: "集中時間終了！", description: "休憩の時間です。", variant: "default" });
      } else {
        setCurrentPhase("focus");
        setTimeLeft(focusDuration * 60);
        toast({ title: "休憩時間終了！", description: "集中に戻りましょう！", variant: "default" });
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, currentPhase, focusDuration, breakDuration, toast, playAlarm]);

  const handleStartPause = async () => {
    await initializeAudio(); 
    setIsActive((prev) => !prev);
    if (!isActive && timeLeft === 0) { 
        setTimeLeft(currentPhase === "focus" ? focusDuration * 60 : breakDuration * 60);
    }
  };

  const handleReset = () => {
    setIsActive(false);
    setCurrentPhase("focus");
    setTimeLeft(focusDuration * 60);
    toast({ title: "タイマーリセット", description: "新しい集中セッションを開始する準備ができました。" });
  };

  const handleSkip = async () => {
    await initializeAudio();
    playAlarm();
    if (currentPhase === "focus") {
      setTotalFocusedSeconds((prev) => prev + (focusDuration * 60 - timeLeft)); 
      setCurrentPhase("break");
      setTimeLeft(breakDuration * 60);
      toast({ title: "休憩にスキップしました", description: "休憩をお楽しみください！", variant: "default" });
    } else {
      setCurrentPhase("focus");
      setTimeLeft(focusDuration * 60);
      toast({ title: "集中にスキップしました", description: "集中する時間です！", variant: "default" });
    }
    setIsActive(true); 
  };

  const handleSaveSettings = () => {
    const newFocus = parseInt(customFocusDuration, 10);
    const newBreak = parseInt(customBreakDuration, 10);
    const newVolume = parseInt(customAlarmVolume, 10);

    if (isNaN(newFocus) || newFocus <= 0 || isNaN(newBreak) || newBreak <= 0) {
      toast({ title: "無効な入力", description: "時間は正の数でなければなりません。", variant: "destructive" });
      return;
    }
    if (isNaN(newVolume) || newVolume < 0 || newVolume > 100) {
      toast({ title: "無効な入力", description: "音量は0から100の間でなければなりません。", variant: "destructive" });
      return;
    }

    setFocusDuration(newFocus);
    setBreakDuration(newBreak);
    setAlarmVolume(newVolume);

    if (!isActive) {
      if (currentPhase === "focus") {
        setTimeLeft(newFocus * 60);
      } else {
        setTimeLeft(newBreak * 60);
      }
    }
    setIsSettingsOpen(false);
    toast({ title: "設定を保存しました", description: `集中: ${newFocus}分、休憩: ${newBreak}分、音量: ${newVolume}%。` });
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
    if (hours > 0) parts.push(`${hours}時間`);
    if (minutes > 0) parts.push(`${minutes}分`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);
    return parts.join(" ");
  };

  const currentPhaseTotalDuration = (currentPhase === "focus" ? focusDuration : breakDuration) * 60;
  const progressPercentage = currentPhaseTotalDuration > 0 ? ((currentPhaseTotalDuration - timeLeft) / currentPhaseTotalDuration) * 100 : 0;

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-headline text-3xl">ポモドーロ タイムフロー</CardTitle>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => {
                setCustomFocusDuration(focusDuration.toString());
                setCustomBreakDuration(breakDuration.toString());
                setCustomAlarmVolume(alarmVolume.toString());
              }}>
                <Settings className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-headline">タイマー設定</DialogTitle>
                <DialogDescription>
                  集中時間、休憩時間、アラーム音量を設定します。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="focus-duration" className="text-right">
                    集中
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
                    休憩
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="alarm-volume" className="text-right">
                    音量
                  </Label>
                  <Slider
                    id="alarm-volume"
                    value={[parseInt(customAlarmVolume, 10)]}
                    onValueChange={(value) => setCustomAlarmVolume(value[0].toString())}
                    max={100}
                    step={1}
                    className="col-span-2"
                  />
                  <span className="text-sm tabular-nums">{customAlarmVolume}%</span>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={playAlarm} 
                  aria-label="アラーム音をテスト再生"
                  className="mr-auto"
                >
                  <span role="img" aria-label="bell emoji">🔔</span>
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(false)}>キャンセル</Button>
                <Button type="submit" onClick={handleSaveSettings}>変更を保存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 py-8">
          <div className="text-center">
            <p className="text-xl font-medium text-primary mb-2">
              {currentPhase === "focus" ? "集中時間" : "休憩時間"}
            </p>
            <h2 className="text-7xl font-bold text-accent font-mono tabular-nums tracking-tight">
              {formatTime(timeLeft)}
            </h2>
          </div>
          <Progress value={progressPercentage} className="w-full h-3 transition-all duration-500" />
          <div className="flex space-x-4">
            <Button onClick={handleStartPause} size="lg" className="px-4 text-base">
              {isActive ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
              {isActive ? "一時停止" : "開始"}
            </Button>
            <Button onClick={handleReset} variant="outline" size="lg" className="px-4 text-base">
              <RotateCcw className="mr-2 h-5 w-5" /> リセット
            </Button>
            <Button onClick={handleSkip} variant="secondary" size="lg" className="px-4 text-base">
              <SkipForward className="mr-2 h-5 w-5" /> スキップ
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center text-muted-foreground">
          <p>合計集中時間: {formatTotalFocusedTime(totalFocusedSeconds)}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
