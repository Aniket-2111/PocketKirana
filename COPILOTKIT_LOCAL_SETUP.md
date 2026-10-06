# CopilotKit local setup

The PocketKirana Assistant Lab lives at `/assistant`. It uses CopilotKit's v2 BuiltInAgent and React APIs, with the Next.js app hosting the Runtime at `/api/copilotkit`.

## 1. Install the packages

The dependencies are declared in `package.json`. From the repository root, run this to download them and refresh `package-lock.json`:

```powershell
npm install
```

## 2. Configure the model key

Add your model provider key to the ignored `.env.local` file in the repository root:

```dotenv
OPENAI_API_KEY=your_openai_key
COPILOTKIT_MODEL=openai/gpt-4o-mini
```

The model key is used only by the server runtime. Do not add a `NEXT_PUBLIC_` prefix.

## 3. Enable saved AG-UI conversations and Automatic Learning

For saved threads and replayable AG-UI streams, connect a CopilotKit Intelligence project. From the repository root, run:

```powershell
npx copilotkit@latest login
npx copilotkit@latest project select
```

The project selection command writes `CPK_INTELLIGENCE_API_KEY` to a local environment file. Keep it server-side. Restart the Next.js development server after changing environment variables.

In that Intelligence project, create a Learning container and add its stable ID to `.env.local`:

```dotenv
CPK_INTELLIGENCE_LEARNING_CONTAINER_ID=your-learning-container-id
```

Automatic Learning analyzes eligible completed threads on its configured schedule. You review and publish proposed Skills in Intelligence; the BuiltInAgent then loads published Skills from the configured container. Learning is not active until the project key and container ID are both present and the container is enabled in Intelligence.

Learning is not immediate: the default first analysis needs 15 eligible completed threads and runs on the container's daily schedule. You can start a manual run from the Intelligence project when the container is ready.

## 4. Run it

Start the existing Next.js development server from the repository root:

```powershell
npm run dev
```

Open [http://localhost:3000/assistant](http://localhost:3000/assistant). The assistant and draft list are isolated from PocketKirana checkout and live product data. The list only changes after you approve the proposed addition; it never submits an order.

Without an Intelligence project key, local chat, Generative UI, shared state, approval prompts, and frontend tools can still run, but conversation history syncing and Automatic Learning remain unavailable.

## Before production

The Runtime requires a verified PocketKirana session outside local development. Production access to the inspector's unscoped thread-event/state and stop endpoints is disabled until per-thread ownership checks are implemented. The assistant demo is not connected to the store's real inventory, prices, cart, or checkout.
