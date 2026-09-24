import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { assistantService } from '../services/assistant.service';
import { getApiErrorMessage } from '../services/api';
import type { AssistantDraft, AssistantSlot, TravelOption } from '../types/assistant';

type ChatItem = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  results?: TravelOption[];
  outsideWindow?: boolean;
  draft?: AssistantDraft;
  quickReplies?: string[];
  error?: boolean;
};

const EXAMPLES = [
  'Train from Vadodara to Mumbai tomorrow morning',
  'Flight from Delhi to Goa on 28 August between 6 and 9 PM',
  'Bus from Ahmedabad to Pune this Friday evening',
];

const TYPE_ICON: Record<string, string> = { TRAIN: '🚆', BUS: '🚌', FLIGHT: '✈️' };

function money(minor: number, currency: string) {
  return (minor / 100).toLocaleString('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 });
}

function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

function summary(draft: AssistantDraft): string[] {
  const parts: string[] = [];
  if (draft.serviceType) parts.push(draft.serviceType.charAt(0) + draft.serviceType.slice(1).toLowerCase());
  if (draft.source || draft.destination) parts.push(`${draft.source ?? '?'} → ${draft.destination ?? '?'}`);
  if (draft.date) {
    const [y, m, d] = draft.date.split('-').map(Number);
    parts.push(new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }));
  }
  if (draft.anyTime) parts.push('Any time');
  else if (draft.timeFrom && draft.timeTo) parts.push(`${draft.timeFrom}–${draft.timeTo}`);
  if (draft.travelClass) parts.push(draft.travelClass);
  return parts;
}

function OptionCard({ option, draft }: { option: TravelOption; draft: AssistantDraft }) {
  const navigate = useNavigate();
  const open = option.classes.filter((c) => c.seatsLeft > 0);
  const chosen = [...open].sort((a, b) => a.fareMinor - b.fareMinor)[0] ?? option.classes[0];

  function schedule() {
    const query = new URLSearchParams({
      serviceType: option.serviceType,
      provider: option.provider,
      source: option.source.code,
      destination: option.destination.code,
      journeyDate: draft.date ?? '',
      trainNumber: option.number,
      travelClass: chosen?.name ?? '',
    });
    navigate(`/bookings/new?${query.toString()}`);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold tabular-nums text-slate-900">{option.departureTime}</span>
            <span className="text-slate-300">──</span>
            <span className="text-2xl font-bold tabular-nums text-slate-900">
              {option.arrivalTime}
              {option.arrivalDayOffset > 0 ? (
                <sup className="ml-0.5 text-xs font-semibold text-amber-600">+{option.arrivalDayOffset}</sup>
              ) : null}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {option.source.code} → {option.destination.code} · {duration(option.durationMinutes)}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-800">
            {TYPE_ICON[option.serviceType]} {option.name}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {option.number} · {option.provider}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">from</p>
          <p className="text-xl font-bold text-slate-900">{money(option.fromFareMinor, option.currency)}</p>
          <Button className="mt-2" onClick={schedule}>
            Schedule booking
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {option.classes.map((c) => (
          <span
            key={c.name}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
              c.seatsLeft > 0 ? 'bg-emerald-50 text-emerald-800 ring-emerald-100' : 'bg-slate-100 text-slate-400 ring-slate-200'
            }`}
          >
            {c.name} · {money(c.fareMinor, option.currency)} · {c.seatsLeft > 0 ? `${c.seatsLeft} left` : 'sold out'}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AssistantPage() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState<AssistantDraft>({});
  const [awaiting, setAwaiting] = useState<AssistantSlot | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items, busy]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setText('');
    setBusy(true);
    setItems((prev) => [...prev, { id: nextId.current++, role: 'user', text: trimmed }]);
    try {
      const response = await assistantService.search({ message: trimmed, draft, awaiting });
      setDraft(response.draft);
      if (response.status === 'NEEDS_INFO') {
        setAwaiting(response.awaiting);
        setItems((prev) => [
          ...prev,
          { id: nextId.current++, role: 'assistant', text: response.reply, quickReplies: response.quickReplies },
        ]);
      } else {
        setAwaiting(null);
        setItems((prev) => [
          ...prev,
          {
            id: nextId.current++,
            role: 'assistant',
            text: response.reply,
            results: response.results,
            outsideWindow: response.outsideWindow,
            draft: response.draft,
          },
        ]);
      }
    } catch (error) {
      setItems((prev) => [
        ...prev,
        { id: nextId.current++, role: 'assistant', text: getApiErrorMessage(error), error: true },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function reset() {
    setItems([]);
    setDraft({});
    setAwaiting(null);
    setText('');
    inputRef.current?.focus();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(text);
  }

  const chips = summary(draft);
  const lastId = items.length ? items[items.length - 1].id : -1;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-4xl flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Where to?</h1>
        <p className="mt-1 text-sm text-slate-500">
          Type it the way you’d say it — train, bus or flight, where from and to, the date and a time window. I’ll ask
          for anything that’s missing.
        </p>
      </div>

      {chips.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
              {chip}
            </span>
          ))}
          <button type="button" onClick={reset} className="text-xs font-semibold text-slate-500 underline-offset-2 hover:underline">
            New search
          </button>
        </div>
      ) : null}

      <div className="flex-1 space-y-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6">
            <p className="text-sm font-medium text-slate-700">Try one of these</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void send(example)}
                  className="rounded-full bg-white px-4 py-2 text-left text-sm text-slate-700 ring-1 ring-slate-200 transition hover:bg-brand-50 hover:ring-brand-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {items.map((item) =>
          item.role === 'user' ? (
            <div key={item.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white shadow-sm">
                {item.text}
              </div>
            </div>
          ) : (
            <div key={item.id} className="space-y-3">
              <div
                className={`max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm shadow-sm ring-1 ${
                  item.error ? 'bg-rose-50 text-rose-800 ring-rose-100' : 'bg-white text-slate-800 ring-slate-200'
                }`}
              >
                {item.text}
              </div>
              {item.quickReplies && item.quickReplies.length > 0 && item.id === lastId ? (
                <div className="flex flex-wrap gap-2">
                  {item.quickReplies.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      disabled={busy}
                      onClick={() => void send(reply)}
                      className="rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50 disabled:opacity-50"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              ) : null}
              {item.results && item.results.length > 0 && item.draft ? (
                <div className="space-y-3">
                  {item.outsideWindow ? (
                    <p className="text-xs font-medium text-amber-700">Nothing in your time window — closest departures:</p>
                  ) : null}
                  {item.results.map((option) => (
                    <OptionCard key={option.id} option={option} draft={item.draft as AssistantDraft} />
                  ))}
                </div>
              ) : null}
            </div>
          ),
        )}

        {busy ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            Looking…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-4 mt-6 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
      >
        <input
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            awaiting ? 'Type your answer…' : 'e.g. train from Vadodara to Mumbai on 28 August between 6 and 8 AM'
          }
          className="flex-1 rounded-xl border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          maxLength={500}
          aria-label="Describe your trip"
        />
        <Button type="submit" loading={busy} disabled={!text.trim()}>
          Search
        </Button>
      </form>
    </div>
  );
}
