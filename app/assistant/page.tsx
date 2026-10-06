import type { Metadata } from "next";
import { AssistantProviders } from "./providers";

export const metadata: Metadata = {
  title: "Assistant Lab",
  description: "Explore CopilotKit's agent features in a local grocery planning demo.",
};

export default function AssistantPage() {
  return (
    <AssistantProviders
      intelligenceConfigured={Boolean(process.env.CPK_INTELLIGENCE_API_KEY)}
      learningConfigured={Boolean(
        process.env.CPK_INTELLIGENCE_API_KEY &&
          process.env.CPK_INTELLIGENCE_LEARNING_CONTAINER_ID,
      )}
      modelConfigured={Boolean(process.env.OPENAI_API_KEY)}
    />
  );
}
