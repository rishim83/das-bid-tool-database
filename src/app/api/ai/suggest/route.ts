import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { SUGGEST_SYSTEM_PROMPT, buildSuggestPrompt } from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
  try {
    const { field, context } = await request.json();

    if (!field || typeof field !== "string") {
      return NextResponse.json(
        { error: "Field name is required" },
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
      max_tokens: 1024,
      system: SUGGEST_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildSuggestPrompt(field, context || {}),
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    const suggestion = JSON.parse(textBlock.text);
    return NextResponse.json(suggestion);
  } catch (error) {
    console.error("AI suggest error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 }
    );
  }
}
