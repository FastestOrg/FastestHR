import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

type InterviewStep = 'loading' | 'intro' | 'permission' | 'connecting' | 'live' | 'wrapping_up' | 'done' | 'error';

interface TranscriptEntry {
  role: 'model' | 'user';
  text: string;
}

export default function AIInterview() {
  const { jobSlug, companySlug, candidateId, hash } = useParams<{
    jobSlug?: string;
    companySlug?: string;
    candidateId?: string;
    hash?: string;
  }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<InterviewStep>('loading');
  const [job, setJob] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  // Load interview/job info
  useEffect(() => {
    (async () => {
      try {
        if (hash) {
          const { data: interview, error: intError } = await supabase
            .from('ai_interviews')
            .select('*, jobs(id, title, requirements, ai_interview_enabled, company_id)')
            .eq('link_hash', hash)
            .single();

          if (intError || !interview) throw new Error('Interview link invalid or not found.');
          
          const now = new Date();
          const expiry = new Date(interview.expires_at);
          if (now > expiry) {
            setStep('error');
            setErrorMsg('This interview link has expired. Please contact HR for a new invite.');
            return;
          }

          if (interview.status === 'completed') {
            setStep('done');
            return;
          }

          const jData = (interview as any).jobs;
          jData.expectations = interview.expectations;
          setJob(jData);

          setStep('intro');
          return;
        }

        // Legacy/Direct flow
        const { data: company } = await supabase
          .from('companies')
          .select('id, name')
          .eq('slug', companySlug!)
          .single();
        if (!company) throw new Error('Company not found');

        const { data: jobData } = await supabase
          .from('jobs')
          .select('id, title, requirements, ai_interview_enabled')
          .eq('job_slug', jobSlug!)
          .eq('company_id', company.id)
          .single();
        if (!jobData) throw new Error('Job not found');
        if (!(jobData as any).ai_interview_enabled) {
          navigate(-1);
          return;
        }
        setJob(jobData);
        setStep('intro');
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load interview');
        setStep('error');
      }
    })();
  }, [companySlug, jobSlug, hash]);

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Timer
  useEffect(() => {
    if (step === 'live') {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Play audio from Gemini Live
  const playAudioChunk = useCallback(async (base64Audio: string) => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      const raw = atob(base64Audio);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      // Gemini Live returns 24kHz 16-bit PCM little-endian
      const pcm = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 32768;

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      console.error('Audio playback error', e);
    }
  }, []);

  const closeSession = useCallback(async () => {
    // Stop mic
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    setIsMicActive(false);

    // Close WS
    wsRef.current?.close();
    wsRef.current = null;

    setStep('wrapping_up');

    // Send transcript to edge function for analysis
    const finalTranscript = transcriptRef.current;
    if (!finalTranscript.length || !candidateId || !job?.id) {
      setStep('done');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-interviewer', {
        body: { 
          action: 'analyze', 
          candidateId: candidateId || (await supabase.from('ai_interviews').select('candidate_id').eq('link_hash', hash!).single()).data?.candidate_id, 
          jobId: job.id, 
          transcript: finalTranscript,
          hash: hash || null
        },
      });
      if (error) throw error;
      setAnalysisResult(data?.result);
    } catch (err) {
      console.error('Analysis failed:', err);
    }
    setStep('done');
  }, [candidateId, job, hash]);

  const startInterview = useCallback(async () => {
    setStep('permission');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch {
      setErrorMsg('Microphone permission denied. Please allow microphone access and try again.');
      setStep('error');
      return;
    }

    setStep('connecting');
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });

    // 1. Mint ephemeral token
    let token: string;
    let wsUrl: string;
    try {
      const { data, error } = await supabase.functions.invoke('ai-interviewer', {
        body: { action: 'token', candidateId, jobId: job.id, hash },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      token = data.token;
      wsUrl = data.wsUrl || (data.endpointType === 'constrained'
        ? `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`
        : `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${token}`);
    } catch (err: any) {
      setErrorMsg('Failed to initialize AI interview: ' + (err.message || 'Unknown error'));
      setStep('error');
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    // 2. Open WebSocket to Gemini Live

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setErrorMsg('Failed to connect to AI interviewer. Please try again.');
      setStep('error');
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      // Send setup message
      const systemInstruction = `You are "Fastu", an expert AI Interviewer for FastestHR. 
        You are interviewing for the position: ${job.title}.
        Job Requirements: ${job.requirements || 'N/A'}.
        
        HR has specified these key expectations for this candidate:
        ${JSON.stringify(job.expectations || [])}
        
        Your goal:
        1. Welcome the candidate.
        2. Ask 4-5 targeted questions to assess their fit based on requirements and expectations.
        3. Be professional, encouraging, and brief.
        4. When done, thank them and say goodbye clearly (mentioning "all the best" or "goodbye").
        
        Keep your turns short. Wait for the candidate to finish before responding.`;

      ws.send(JSON.stringify({
        setup: {
          model: 'models/gemini-2.0-flash-exp', // Using 2.0 Flash for better Live experience
          system_instruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
            },
          },
        },
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Setup complete - start mic
        if (msg.setupComplete !== undefined || msg.setup_complete !== undefined) {
          setStep('live');
          setIsMicActive(true);
          startMicStreaming(stream, ws);
          return;
        }

        const parts = msg.serverContent?.modelTurn?.parts || msg.server_content?.model_turn?.parts || [];
        for (const part of parts) {
          // Audio from Gemini
          if (part.inlineData?.mimeType?.startsWith('audio/') || part.inline_data?.mime_type?.startsWith('audio/')) {
            const b64 = part.inlineData?.data || part.inline_data?.data;
            if (b64) {
              setIsAISpeaking(true);
              await playAudioChunk(b64);
            }
          }
          // Text transcript from model
          if (part.text) {
            const entry: TranscriptEntry = { role: 'model', text: part.text };
            setTranscript(prev => [...prev, entry]);
            transcriptRef.current = [...transcriptRef.current, entry];
          }
        }

        // Turn complete
        if (msg.serverContent?.turnComplete || msg.server_content?.turn_complete) {
          setIsAISpeaking(false);
          // Auto end if AI said goodbye (simple heuristic)
          const lastModel = transcriptRef.current.filter(t => t.role === 'model').pop();
          if (lastModel?.text?.toLowerCase().match(/\b(thank you|goodbye|all the best|hear from you soon|best of luck)\b/)) {
            setTimeout(() => closeSession(), 3000);
          }
        }
      } catch (e) {
        // Binary frames — ignore or handle
      }
    };

    ws.onerror = () => {
      setErrorMsg('Lost connection to AI interviewer.');
      setStep('error');
    };

    ws.onclose = () => {
      setIsMicActive(false);
      setIsAISpeaking(false);
    };
  }, [candidateId, job, playAudioChunk, closeSession]);

  const startMicStreaming = (stream: MediaStream, ws: WebSocket) => {
    // Use ScriptProcessor to get raw PCM
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    const source = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const float32 = e.inputBuffer.getChannelData(0);
      // Convert float32 to 16-bit PCM
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
      }
      const b64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
      ws.send(JSON.stringify({
        realtimeInput: { audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } },
      }));
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);
    mediaRecorderRef.current = { stream, stop: () => { processor.disconnect(); audioCtx.close(); } } as any;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      mediaRecorderRef.current?.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground max-w-xs">{errorMsg}</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-8 text-center">
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <div className="absolute -inset-2 rounded-full border-2 border-green-500/20 animate-ping" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Interview Complete!</h2>
          <p className="text-muted-foreground max-w-sm">
            Thank you for completing the AI screening interview for <span className="font-medium text-foreground">{job?.title}</span>.
            Your responses have been recorded and will be reviewed by the hiring team.
          </p>
        </div>
        {analysisResult && (
          <div className="rounded-2xl border border-border/50 bg-card p-4 text-left max-w-sm w-full space-y-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Your Interview Score</p>
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-foreground">{analysisResult.ai_score}<span className="text-lg text-muted-foreground">/10</span></div>
              <div className="text-sm text-muted-foreground">{analysisResult.summary}</div>
            </div>
          </div>
        )}
        <Button onClick={() => navigate(`/company/${companySlug}`)}>Return to Career Page</Button>
      </div>
    );
  }

  if (step === 'wrapping_up') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h2 className="text-xl font-semibold">Analyzing your responses…</h2>
        <p className="text-muted-foreground">This will only take a moment.</p>
      </div>
    );
  }

  // Intro / Permission / Connecting / Live
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mic className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{job?.title}</p>
            <p className="text-xs text-muted-foreground">AI Screening Interview</p>
          </div>
        </div>
        {step === 'live' && (
          <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            {formatTime(elapsedSeconds)}
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full gap-8">

        {/* AI Avatar */}
        <div className="relative">
          <div className={`h-32 w-32 rounded-full flex items-center justify-center transition-all duration-500 ${
            isAISpeaking
              ? 'bg-primary/20 shadow-[0_0_40px_rgba(var(--primary),.4)]'
              : step === 'live'
              ? 'bg-primary/10'
              : 'bg-muted'
          }`}>
            {isAISpeaking ? (
              <Volume2 className="h-12 w-12 text-primary animate-pulse" />
            ) : (
              <Mic className={`h-12 w-12 ${step === 'live' ? 'text-primary' : 'text-muted-foreground'}`} />
            )}
          </div>
          {isAISpeaking && (
            <div className="absolute -inset-4 rounded-full border-2 border-primary/20 animate-ping" />
          )}
          {isMicActive && !isAISpeaking && (
            <div className="absolute -inset-4 rounded-full border-2 border-green-500/20 animate-ping" />
          )}
        </div>

        {/* Step content */}
        {step === 'intro' && (
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold">AI Screening Interview</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You're about to have a <strong>~5 minute voice conversation</strong> with Fastu, our AI interviewer.
              Fastu will ask you a few questions about your background and experience to assess your fit for this role.
              Your responses will be analyzed and shared with the hiring team.
            </p>
            <div className="grid grid-cols-3 gap-3 text-center mt-2">
              {[['🎙', 'Voice Only', 'Speak naturally'], ['🤖', 'AI Powered', 'Gemini Live'], ['⏱', '~5 mins', 'Just a quick chat']].map(([icon, label, sub]) => (
                <div key={label} className="rounded-xl bg-muted/40 p-3 space-y-1">
                  <div className="text-2xl">{icon}</div>
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="text-[10px] text-muted-foreground">{sub}</div>
                </div>
              ))}
            </div>
            <Button onClick={startInterview} size="lg" className="w-full mt-2 gap-2">
              <Mic className="h-5 w-5" /> Start Interview
            </Button>
          </div>
        )}

        {step === 'permission' && (
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="font-medium">Requesting microphone access…</p>
            <p className="text-sm text-muted-foreground">Please allow microphone access in your browser when prompted.</p>
          </div>
        )}

        {step === 'connecting' && (
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="font-medium">Connecting to Fastu AI…</p>
            <p className="text-sm text-muted-foreground">Establishing secure audio session.</p>
          </div>
        )}

        {step === 'live' && (
          <div className="w-full space-y-4">
            {/* Status pills */}
            <div className="flex items-center justify-center gap-3">
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${isMicActive ? 'border-green-500/30 bg-green-500/10 text-green-500' : 'border-border text-muted-foreground'}`}>
                {isMicActive ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                {isMicActive ? 'Mic Active' : 'Mic Off'}
              </div>
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${isAISpeaking ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                <Volume2 className="h-3 w-3" />
                {isAISpeaking ? 'Fastu is speaking…' : 'Listening…'}
              </div>
            </div>

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="rounded-xl border border-border/40 bg-muted/20 p-4 max-h-56 overflow-y-auto space-y-3">
                {transcript.map((entry, i) => (
                  <div key={i} className={`flex gap-2 ${entry.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] ${
                      entry.role === 'model'
                        ? 'bg-primary/10 text-foreground'
                        : 'bg-muted text-foreground'
                    }`}>
                      {entry.text}
                    </div>
                  </div>
                ))}
                <div ref={transcriptBottomRef} />
              </div>
            )}

            <Button
              variant="destructive"
              onClick={closeSession}
              className="w-full gap-2"
            >
              <MicOff className="h-4 w-4" />
              End Interview
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Speak clearly and take your time. The AI will respond after you finish speaking.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
