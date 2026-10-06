"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  CopilotChatConfigurationProvider,
  CopilotKitProvider,
  CopilotChatToolCallsView,
  ToolCallStatus,
} from "@copilotkit/react-core/v2";
import {
  useAgent,
  useComponent,
  useCopilotKit,
  useFrontendTool,
  useHumanInTheLoop,
  useThreads,
} from "@copilotkit/react-core/v2/headless";
import { z } from "zod";

type CartItem = { name: string; quantity: number };
type AgentState = Record<string, unknown> & { draftCart?: CartItem[] };

const sampleCatalog = [
  { name: "Bananas", category: "Fruit", note: "A handy fruit for breakfast and snacks." },
  { name: "Tomatoes", category: "Vegetable", note: "A versatile base for everyday meals." },
  { name: "Milk", category: "Dairy", note: "A common staple for tea, coffee, and cereal." },
  { name: "Rice", category: "Pantry", note: "A pantry staple for many meals." },
  { name: "Spinach", category: "Vegetable", note: "A leafy green that works in quick curries." },
  { name: "Yogurt", category: "Dairy", note: "Pairs well with meals or fruit." },
];

const ideaSchema = z.object({
  title: z.string().describe("Short title for this grocery or recipe idea"),
  items: z.array(z.string()).min(1).describe("Illustrative grocery items for the idea"),
  note: z.string().describe("A short explanation of the idea"),
});

const cartRequestSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().describe("Grocery item name"),
        quantity: z.number().int().min(1).max(20).describe("Requested quantity"),
      }),
    )
    .min(1),
  reason: z.string().describe("Brief reason for this draft cart suggestion"),
});

type AssistantMessage = ComponentProps<typeof CopilotChatToolCallsView>["message"];
type CopilotMessages = NonNullable<ComponentProps<typeof CopilotChatToolCallsView>["messages"]>;
type MessageLike = { id?: string; role: string; content?: unknown };

function GroceryIdeaCard({ title, items, note }: z.infer<typeof ideaSchema>) {
  return (
    <section className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-slate-800">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Idea · illustrative only</div>
      <h3 className="mt-1 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{note}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span key={`${item}-${index}`} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-emerald-100">
            {item}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">This demo does not check PocketKirana stock or prices.</p>
    </section>
  );
}

export function AssistantProviders({
  intelligenceConfigured,
  learningConfigured,
  modelConfigured,
}: {
  intelligenceConfigured: boolean;
  learningConfigured: boolean;
  modelConfigured: boolean;
}) {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" agentId="default">
      <AssistantWorkspace
        intelligenceConfigured={intelligenceConfigured}
        learningConfigured={learningConfigured}
        modelConfigured={modelConfigured}
      />
    </CopilotKitProvider>
  );
}

function AssistantWorkspace({
  intelligenceConfigured,
  learningConfigured,
  modelConfigured,
}: {
  intelligenceConfigured: boolean;
  learningConfigured: boolean;
  modelConfigured: boolean;
}) {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(true);

  useEffect(() => {
    setActiveThreadId(crypto.randomUUID());
  }, []);

  const startNewThread = () => setActiveThreadId(crypto.randomUUID());

  return (
    <main className="min-h-screen bg-[#f5f7f4] text-slate-900">
      <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-700 text-lg font-bold text-white">P</div>
          <div>
            <div className="font-semibold leading-tight">PocketKirana</div>
            <div className="text-xs text-slate-500">CopilotKit assistant lab</div>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Local feature demo
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1600px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        {threadsOpen && (
          <ThreadSidebar
            activeThreadId={activeThreadId}
            onSelect={setActiveThreadId}
            onNew={startNewThread}
            intelligenceConfigured={intelligenceConfigured}
          />
        )}

        <section className="flex min-h-[680px] min-w-0 flex-col bg-white">
          <div className="flex h-[66px] items-center justify-between border-b border-slate-100 px-5 sm:px-7">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setThreadsOpen((open) => !open)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                {threadsOpen ? "Hide history" : "Show history"}
              </button>
              <div>
                <div className="text-sm font-semibold">Grocery planning assistant</div>
                <div className="text-xs text-slate-500">Chat, ideas, and an approval-based draft list</div>
              </div>
            </div>
            <div className="hidden rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-500 sm:block">
              Does not place orders
            </div>
          </div>

          {activeThreadId ? (
            <CopilotChatConfigurationProvider key={activeThreadId} agentId="default" threadId={activeThreadId}>
              <ChatAndCart
                modelConfigured={modelConfigured}
                intelligenceConfigured={intelligenceConfigured}
                learningConfigured={learningConfigured}
              />
            </CopilotChatConfigurationProvider>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-slate-500">Starting a conversation…</div>
          )}
        </section>

        <div className="hidden border-l border-slate-200 bg-[#fbfcfa] xl:block">
          {activeThreadId ? (
            <CopilotChatConfigurationProvider key={`cart-${activeThreadId}`} agentId="default" threadId={activeThreadId}>
              <CartSidebar />
            </CopilotChatConfigurationProvider>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ThreadSidebar({
  activeThreadId,
  onSelect,
  onNew,
  intelligenceConfigured,
}: {
  activeThreadId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  intelligenceConfigured: boolean;
}) {
  const { threads, isLoading, error } = useThreads({ agentId: "default" });

  return (
    <aside className="flex min-h-[300px] flex-col border-b border-slate-200 bg-[#f8faf7] p-4 lg:min-h-0 lg:border-b-0 lg:border-r">
      <button onClick={onNew} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800">
        <span className="text-lg leading-none">＋</span> New conversation
      </button>
      <div className="mb-2 mt-6 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recent conversations</h2>
        {intelligenceConfigured && <span className="h-2 w-2 rounded-full bg-emerald-500" title="CopilotKit Intelligence configured" />}
      </div>
      {!intelligenceConfigured && (
        <p className="mb-3 rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200">
          Connect a CopilotKit Intelligence project key to sync conversation history.
        </p>
      )}
      {error && intelligenceConfigured && <p className="mb-3 text-xs text-amber-700">Conversation history is unavailable until Intelligence is enabled for this project.</p>}
      <div className="space-y-1">
        {isLoading && intelligenceConfigured && <p className="px-2 py-3 text-xs text-slate-400">Loading conversations…</p>}
        {!isLoading && threads.length === 0 && intelligenceConfigured && !error && (
          <p className="px-2 py-3 text-xs leading-relaxed text-slate-400">Your saved conversations will appear here after your first message.</p>
        )}
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${activeThreadId === thread.id ? "bg-emerald-100 text-emerald-950" : "text-slate-600 hover:bg-white"}`}
          >
            <span className="block truncate font-medium">{thread.name || "Untitled conversation"}</span>
            <span className="mt-1 block text-[11px] text-slate-400">Saved with CopilotKit Intelligence</span>
          </button>
        ))}
      </div>
      <div className="mt-auto hidden border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-400 lg:block">
        A custom, headless chat UI powered by CopilotKit and AG-UI.
      </div>
    </aside>
  );
}

function ChatAndCart({
  modelConfigured,
  intelligenceConfigured,
  learningConfigured,
}: {
  modelConfigured: boolean;
  intelligenceConfigured: boolean;
  learningConfigured: boolean;
}) {
  const { agent, isReady } = useAgent();
  const { copilotkit } = useCopilotKit();
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const ideaRenderer = useMemo(() => GroceryIdeaCard, []);
  useComponent(
    {
      name: "show_grocery_idea",
      description: "Render an illustrative grocery or recipe idea as a visual card. Do not present it as live store inventory.",
      parameters: ideaSchema,
      render: ideaRenderer,
      followUp: false,
    },
    [ideaRenderer],
  );

  useFrontendTool(
    {
      name: "read_draft_cart",
      description: "Read the current shared draft grocery list in this browser session.",
      parameters: z.object({}),
      handler: async () => JSON.stringify((agent.state as AgentState | undefined)?.draftCart ?? []),
    },
    [agent],
  );

  useFrontendTool(
    {
      name: "search_example_groceries",
      description: "Search a tiny illustrative list of common grocery examples. This is not a live PocketKirana catalog and includes no stock or price data.",
      parameters: z.object({ query: z.string().min(1) }),
      handler: async ({ query }) => {
        const normalized = query.toLowerCase();
        const matches = sampleCatalog.filter((item) =>
          `${item.name} ${item.category} ${item.note}`.toLowerCase().includes(normalized),
        );
        return JSON.stringify({ source: "illustrative demo data", matches });
      },
    },
    [],
  );

  useHumanInTheLoop(
    {
      name: "request_cart_addition",
      description: "Ask the user to approve adding grocery items to the shared draft list. Always use this before changing the list at the user's request. This does not place an order.",
      parameters: cartRequestSchema,
      render: ({ args, status, respond, result }) => {
        if (status === ToolCallStatus.InProgress) {
          return <div className="mt-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-500">Preparing a draft-list change for your review…</div>;
        }

        if (status === ToolCallStatus.Executing && respond) {
          return (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">Your approval needed</div>
              <p className="mt-1 text-sm font-medium">Add these items to the draft list?</p>
              <p className="mt-1 text-xs text-slate-600">{args.reason}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {args.items.map((item, index) => <li key={`${item.name}-${index}`}>{item.quantity} × {item.name}</li>)}
              </ul>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = (agent.state as AgentState | undefined)?.draftCart ?? [];
                    const next = [...current];
                    for (const requested of args.items) {
                      const existing = next.find((item) => item.name.toLowerCase() === requested.name.toLowerCase());
                      if (existing) existing.quantity = Math.min(99, existing.quantity + requested.quantity);
                      else next.push({ name: requested.name, quantity: requested.quantity });
                    }
                    agent.setState({ ...(agent.state as AgentState | undefined), draftCart: next });
                    respond({ approved: true, added: args.items, draftCart: next });
                  }}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >Approve addition
                </button>
                <button type="button" onClick={() => respond({ approved: false })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Decline
                </button>
              </div>
            </div>
          );
        }

        if (status === ToolCallStatus.Complete && result) {
          let approved = false;
          try { approved = Boolean(JSON.parse(result)?.approved); } catch { approved = false; }
          return <div className="mt-2 text-xs text-slate-500">{approved ? "Added to your draft list." : "No changes made."}</div>;
        }

        return null;
      },
    },
    [agent],
  );

  useEffect(() => {
    if (!isReady) return;
    if (!Array.isArray((agent.state as AgentState | undefined)?.draftCart)) {
      agent.setState({ ...(agent.state as AgentState | undefined), draftCart: [] });
    }
  }, [agent, isReady]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [agent.messages.length, agent.isRunning]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || agent.isRunning || !isReady) return;
    setSendError(null);
    agent.addMessage({ id: crypto.randomUUID(), role: "user", content });
    setInput("");
    try {
      await copilotkit.runAgent({ agent });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "The assistant could not complete that request.");
    }
  };

  const draftCart = (agent.state as AgentState | undefined)?.draftCart ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <div className="flex min-h-[580px] min-w-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">
          {!modelConfigured && (
            <SetupNotice title="Add your model API key" detail="The chat is wired up, but it needs OPENAI_API_KEY in your ignored .env.local file before it can answer." />
          )}
          {intelligenceConfigured && !learningConfigured && (
            <SetupNotice title="Turn on Automatic Learning" detail="Create a Learning container in your CopilotKit Intelligence project, then set CPK_INTELLIGENCE_LEARNING_CONTAINER_ID." />
          )}
          {!intelligenceConfigured && (
            <SetupNotice title="Connect CopilotKit Intelligence" detail="Chat and the local demo tools work without it. Add CPK_INTELLIGENCE_API_KEY to enable saved AG-UI conversations; add a Learning container ID to collect runs for Automatic Learning." />
          )}

          {agent.messages.length === 0 && (
            <div className="mx-auto mt-10 max-w-xl text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-2xl text-emerald-800">✦</div>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">What would you like to plan?</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">Ask for a grocery idea, recipe list, or a draft list. You review every addition before it changes the shared list.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[
                  "Suggest a simple breakfast grocery list",
                  "Show me an idea for a quick spinach meal",
                  "Add bananas and milk to my draft list",
                ].map((suggestion) => (
                  <button key={suggestion} onClick={() => void send(suggestion)} disabled={!isReady || !modelConfigured} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(agent.messages as CopilotMessages).map((rawMessage, index) => {
            const message = rawMessage as MessageLike;
            if (message.role !== "user" && message.role !== "assistant") return null;
            const content = typeof message.content === "string" ? message.content : "";
            return (
              <div key={message.id || index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] ${message.role === "user" ? "rounded-2xl rounded-br-md bg-emerald-700 px-4 py-3 text-white" : "w-full max-w-2xl"}`}>
                  {content && <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>}
                  {message.role === "assistant" && (
                    <CopilotChatToolCallsView message={message as AssistantMessage} messages={agent.messages as CopilotMessages} />
                  )}
                </div>
              </div>
            );
          })}
          {agent.isRunning && <div className="text-sm text-slate-400">Assistant is thinking…</div>}
          <div ref={messagesEndRef} />
        </div>

        {sendError && <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-8">{sendError}</div>}
        <form
          onSubmit={(event) => { event.preventDefault(); void send(input); }}
          className="border-t border-slate-100 bg-white p-4 sm:px-8 sm:py-5"
        >
          <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }}
              rows={1}
              placeholder="Ask about meal ideas or grocery planning…"
              className="max-h-32 min-h-10 flex-1 resize-y border-0 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400"
            />
            <button type="submit" disabled={!input.trim() || agent.isRunning || !isReady || !modelConfigured} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-lg text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300" aria-label="Send message">
              ↑
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">Demo only · no live catalog or checkout · verify important information</p>
        </form>
      </div>

      <div className="border-t border-slate-200 bg-[#fbfcfa] xl:hidden">
        <CartContents items={draftCart} agent={agent} />
      </div>
    </div>
  );
}

function CartSidebar() {
  const { agent } = useAgent();
  const items = (agent.state as AgentState | undefined)?.draftCart ?? [];
  return <CartContents items={items} agent={agent} />;
}

function CartContents({ items, agent }: { items: CartItem[]; agent: ReturnType<typeof useAgent>["agent"] }) {
  const removeItem = (name: string) => {
    const state = agent.state as AgentState | undefined;
    agent.setState({ ...state, draftCart: items.filter((item) => item.name !== name) });
  };

  return (
    <aside className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Draft grocery list</h2>
          <p className="mt-1 text-xs text-slate-500">Shared agent state · this thread</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">{items.reduce((total, item) => total + item.quantity, 0)}</span>
      </div>
      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
          <div className="text-2xl">🧺</div>
          <p className="mt-2 text-sm font-medium text-slate-700">Your list is empty</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Ask the assistant to suggest items. It will ask before adding them.</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-3">
          {items.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-slate-500">Quantity: {item.quantity}</p>
              </div>
              <button onClick={() => removeItem(item.name)} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${item.name}`}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 rounded-xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-500">This list is only a planning demo. It is not connected to inventory, pricing, or checkout.</div>
    </aside>
  );
}

function SetupNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#fbfcfa] px-4 py-3">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}
