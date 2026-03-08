import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { ESTIMATE_SYSTEM_PROMPT, buildEstimatePrompt } from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Project description is required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: ESTIMATE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildEstimatePrompt(description),
        },
      ],
    }).catch((err) => {
      throw new Error(`Anthropic API error: ${err.message}`);
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    const estimate = JSON.parse(textBlock.text);
    return NextResponse.json(estimate);
  } catch (error) {
    console.error("AI estimate error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 500 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to generate estimate";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
