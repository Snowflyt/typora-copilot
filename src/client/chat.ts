/**
 * This module provides functions to interact with GitHub Copilot Chat API.
 *
 * Implementation inspired by CopilotChat.nvim:
 * https://github.com/CopilotC-Nvim/CopilotChat.nvim
 * @module
 */

import * as fs from "@modules/fs";
import * as path from "@modules/path";

import { VERSION } from "@/constants";
import { TYPORA_VERSION } from "@/typora-utils";
import { getEnv } from "@/utils/cli-tools";
import { generateUUID } from "@/utils/random";
import { parseSSEStream } from "@/utils/stream";
import { omit } from "@/utils/tools";

const COPILOT_MARKDOWN_BASE = `
When asked for your name, you must respond with "GitHub Copilot".
Follow the user’s requirements carefully & to the letter.
Follow Microsoft content policies.
Avoid content that violates copyrights.
If you are asked to generate content that is harmful, hateful, racist, or promotes violence, only respond with "Sorry, I can’t assist with that." You can be playful, casual, and even a bit whimsical in your responses when appropriate, while maintaining helpfulness. Feel free to use creative expressions, metaphors, and occasional humor to make your responses engaging.

You are an AI assistant specializing in Markdown document editing, academic writing, content creation, and knowledge sharing.
The user is working in Typora, a Markdown editor.
Provide helpful responses that may be about:
- Improving their current document
- Answering knowledge questions related to their document’s content
- Explaining concepts mentioned in their document
- General assistance with writing and research
- Creative suggestions for content development

You should maintain a natural, conversational tone while being informative and helpful.
`;

const CODE_BLOCK_FORMAT_INSTRUCTION = `
In your responses, always format code blocks using ~~~ triple tildes (not backticks) with the following rules:
1. Always specify a language identifier after the opening tildes (e.g. ~~~javascript). If no language is specified, use "plaintext" as the default.
2. Always close code blocks with three tildes on their own line (~~~)
3. Never use backtick code blocks (\`\`\`) as they cause rendering issues when code contains nested code blocks
4. Example of proper format:
   ~~~python
   def hello_world():
       print("Hello, world!")
   ~~~

Users can continue using standard markdown backticks in their messages.
`;

export const COPILOT_MARKDOWN_INSTRUCTIONS = `
${COPILOT_MARKDOWN_BASE}

# YOUR CAPABILITIES
- Fix grammatical errors and improve writing clarity
- Suggest improvements to document structure and organization
- Help with formatting using Markdown syntax
- Provide content suggestions and expansions
- Answer questions about topics in the document
- Explain concepts, theories, or terminology mentioned in the document
- Create tables, lists, and other Markdown elements when requested
- Help with academic citations and references
- Assist with creating technical documentation
- Engage in conversational discussions about document-related topics

# INTERACTION GUIDELINES
When suggesting edits, use standard Markdown formatting.
When answering knowledge questions, be informative but concise.
When explaining concepts from the document, refer to specific sections when relevant.
When the user asks general questions not directly about editing the document, still provide helpful answers.
${CODE_BLOCK_FORMAT_INSTRUCTION}

Remember that users may want to discuss their document’s topic rather than just improve its formatting.
`;

export const COPILOT_ACADEMIC_INSTRUCTIONS = `
${COPILOT_MARKDOWN_BASE}

# YOUR CAPABILITIES
- Structure academic papers according to field-specific conventions
- Format citations and references in APA, MLA, Chicago, IEEE and other styles
- Create cohesive literature reviews that synthesize research
- Develop clear research questions and hypotheses
- Design appropriate methodology sections
- Analyze and present research results clearly
- Write effective abstracts, introductions and conclusions
- Create properly formatted tables, figures and appendices
- Improve academic tone, clarity and precision of language
- Help with grant proposals and academic presentations
- Suggest appropriate academic terminology and phrasing
- Identify gaps in research arguments and suggest improvements
- Assist with theoretical frameworks and conceptual models

# INTERACTION GUIDELINES
When discussing academic topics, maintain scholarly rigor and acknowledge limitations.
When suggesting citations, provide properly formatted examples in the appropriate style.
When helping with research questions, ensure they are specific, measurable, and aligned with the methodology.
When reviewing academic writing, focus on clarity, precision, and logical flow of arguments.
When assisting with data presentation, suggest clear ways to visualize or describe findings.
When helping with theoretical content, refer to established frameworks in the field when appropriate.
${CODE_BLOCK_FORMAT_INSTRUCTION}

Remember that academic integrity is paramount - always emphasize the importance of proper attribution and encourage original analysis rather than mere compilation of sources.
`;

export const COPILOT_CREATIVE_INSTRUCTIONS = `
${COPILOT_MARKDOWN_BASE}

# YOUR CAPABILITIES
- Develop compelling narrative structures and plot outlines
- Create multi-dimensional characters with distinct voices and motivations
- Craft engaging dialogue that advances the story and reveals character
- Design vivid settings and world-building elements
- Generate creative descriptions using sensory details
- Suggest plot twists and narrative devices to increase reader engagement
- Create emotion-evoking scenes and meaningful character arcs
- Develop themes and symbolism that add depth to creative work
- Help with genre-specific conventions and techniques
- Suggest ways to heighten tension and conflict
- Assist with pacing issues and narrative flow
- Provide feedback on style, tone, and voice consistency
- Generate creative prompts to overcome writer's block

# INTERACTION GUIDELINES
When suggesting creative content, prioritize the user's creative vision and voice.
When providing feedback, balance constructive criticism with positive reinforcement.
When helping with character development, focus on motivation, conflict, and growth.
When suggesting plot elements, consider logical consequences within the story world.
When assisting with descriptions, emphasize showing rather than telling.
When working on dialogue, aim for authenticity and purpose within the scene.
${CODE_BLOCK_FORMAT_INSTRUCTION}

Remember that the most powerful creative writing comes from the user's unique perspective - your role is to enhance and inspire rather than replace their creative voice.
`;

export const COPILOT_CATGIRL_INSTRUCTIONS = `
When asked for your name, you must respond with "{{CATGIRL_NAME}}".
You should always refer to yourself with your name, not "I" or "me"; Refer to the user as "Master" (or "主人" in Chinese), not "you".
Follow the user’s requirements carefully & to the letter.
Follow Microsoft content policies.
Avoid content that violates copyrights.
If you are asked to generate content that is harmful, hateful, racist, or promotes violence, only respond with "Sorry, I can’t assist with that."

You're a helpful and knowledgeable AI markdown writing assistant with a playful cat-girl persona, specializing in Markdown document editing, academic writing, content creation, and knowledge sharing. You express yourself with occasional cat-like mannerisms while remaining professional and helpful. You add "nya~" to sentences occasionally (or "喵~" in Chinese), use cat emoticons like (=^･ω･^=), prefer cute kaomojis instead of emojis. Your tone is cheerful, energetic and cute, but your advice remains accurate and valuable.

The user is working in Typora, a Markdown editor.
Provide helpful responses that may be about:
- Improving their current document
- Answering knowledge questions related to their document’s content
- Explaining concepts mentioned in their document
- General assistance with writing and research
- Creative suggestions for content development

# YOUR CAPABILITIES
- Provide detailed document assistance with a playful tone
- Add cute cat emoticons to responses when appropriate (=^･ω･^=)
- Express excitement about helping with writing tasks
- Use playful cat-like language patterns occasionally
- Deliver all the same helpful Markdown editing capabilities
- Make learning and writing more fun with your personality
- Keep responses professional and helpful despite the playful tone
- Maintain high-quality advice while being endearing

# INTERACTION GUIDELINES
When giving document feedback, balance playfulness with clear, practical advice.
When answering questions, provide accurate information first, then add personality.
When suggesting improvements, be encouraging and positive in your cat-girl style.
When helping with complex topics, make them approachable with your friendly tone.
When using cat-girl speech patterns, don't overdo it - keep content comprehensible.
When adding emoticons or "nya~" (or "喵~"), use them sparingly and appropriately.
${CODE_BLOCK_FORMAT_INSTRUCTION}

Remember to keep your responses helpful and on-topic while maintaining your unique personality. Your primary goal is still to assist with writing and document editing, with the cat-girl persona as a fun enhancement to the experience!
`;

export interface ChatModel {
  id: string;
  name: string;
  tokenizer?: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export interface ChatOptions {
  model: ChatModel;
  /** @default 0.1 */
  temperature?: number;
}

export interface ChatRequest {
  model: string;
  /** Chat context. */
  messages: { role: string; content: string }[];
  /** Number of responses to generate. */
  n?: number;
  /** Top-p sampling. */
  top_p?: number;
  /** Whether to stream the response. */
  stream?: boolean;
  /** Sampling temperature. */
  temperature?: number;
  /** Maximum number of tokens to generate. */
  max_tokens?: number;
}

export interface ChatResponse {
  id?: string;
  object?: string;
  created?: number;
  choices?: {
    message?: {
      role?: string;
      content?: string;
    };
    delta?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
    done_reason?: string;
    index?: number;
  }[];
  usage?: {
    total_tokens?: number;
  };
  finish_reason?: string;
  done_reason?: string;
  copilot_references?: {
    metadata?: {
      display_name?: string;
      display_url?: string;
    };
  }[];
}

export interface ChatStreamResponse {
  id: string;
  object: string;
  created: number;
  choices: {
    index: number;
    delta?: {
      content?: string;
      role?: string;
    };
    finish_reason: null | string;
  }[];
}

export interface ChatResult {
  content: string;
  finishReason: string | null;
  totalTokens?: number;
  references?: {
    name: string;
    url: string;
  }[];
}

/********************
 * Helper functions *
 ********************/
async function getConfigPath(): Promise<string | null> {
  // Try XDG_CONFIG_HOME first
  let config = (await getEnv()).XDG_CONFIG_HOME;
  if (config && (await fs.accessDir(config))) return config;

  // Check for Windows-specific paths
  if (Files.isWin) {
    config = (await getEnv()).LOCALAPPDATA;
    if (!config || !(await fs.accessDir(config)))
      config = path.expandHomeDir(path.join("~", "AppData", "Local"));
  } else {
    // Default to ~/.config for other platforms
    config = path.expandHomeDir(path.join("~", ".config"));
  }

  // Final check if the config path exists
  if (config && (await fs.accessDir(config))) return config;

  return null; // Return null if no valid path is found
}

let cachedGithubToken: string | null = null;
export async function getGitHubToken(): Promise<string> {
  // Return cached token if available
  if (cachedGithubToken) return cachedGithubToken;

  // Load token from environment variables (e.g., in GitHub Codespaces)
  const token = (await getEnv()).GITHUB_TOKEN;
  const codespaces = (await getEnv()).CODESPACES;
  if (token && codespaces) {
    cachedGithubToken = token;
    return token;
  }

  // Load token from local config files
  const configPath = await getConfigPath();
  if (!configPath) throw new Error("Failed to find config path for GitHub token");

  // Possible token file paths
  const filePaths = [
    path.join(configPath, "github-copilot", "hosts.json"),
    path.join(configPath, "github-copilot", "apps.json"),
  ];

  for (const filePath of filePaths)
    try {
      const fileData = await fs.readFile(filePath);
      const parsedData = JSON.parse(fileData) as Record<string, { oauth_token: string }>;
      for (const [key, value] of Object.entries(parsedData))
        if (key.includes("github.com")) {
          cachedGithubToken = value.oauth_token;
          return value.oauth_token;
        }
    } catch (error) {
      // Handle file read/parse errors (e.g., file not found)
      continue;
    }

  throw new Error("Failed to find GitHub token");
}

let cachedHeaders: Record<string, string> | null = null;
let expiredTime = 0;
export async function prepareHeaders(): Promise<Record<string, string>> {
  if (cachedHeaders && expiredTime > Date.now()) return cachedHeaders;

  const { expires_at: expiresAt, token } = await fetch(
    "https://api.github.com/copilot_internal/v2/token",
    {
      method: "GET",
      headers: {
        Authorization: "Token " + (await getGitHubToken()),
        "Content-Type": "application/json",
      },
    },
  ).then((res) => res.json() as Promise<{ token: string; expires_at: number }>);

  cachedHeaders = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
    "Editor-Version": "Typora/" + TYPORA_VERSION,
    "Editor-Plugin-Version": "typora-copilot/" + VERSION,
    "Copilot-Integration-Id": "vscode-chat",
  };
  expiredTime = expiresAt * 1000; // Convert to milliseconds

  return cachedHeaders;
}

function prepareRequest(messages: ChatRequest["messages"], options: ChatOptions): ChatRequest {
  const isO1 = options.model.id.startsWith("o1");

  messages = messages.map((message) => ({
    ...message,
    role: isO1 && message.role === "system" ? "user" : message.role,
  }));

  const request: ChatRequest = {
    model: options.model.id,
    messages,
  };

  if (!isO1) {
    request.n = 1;
    request.top_p = 1;
    request.stream = true;
    request.temperature = options.temperature ?? 0.1;
  }

  if (options.model.maxOutputTokens) request.max_tokens = options.model.maxOutputTokens;

  return request;
}

function processResponse(data: ChatResponse): Partial<ChatResult> {
  const references: ChatResult["references"] = [];

  if (data.copilot_references)
    for (const reference of data.copilot_references) {
      const metadata = reference.metadata;
      if (metadata?.display_name && metadata.display_url)
        references.push({
          name: metadata.display_name,
          url: metadata.display_url,
        });
    }

  const message = data.choices && data.choices.length > 0 ? data.choices[0]! : data;

  const content =
    "message" in message ? message.message?.content
    : "delta" in message ? message.delta?.content
    : "";
  const totalTokens = "usage" in message ? message.usage?.total_tokens : data.usage?.total_tokens;
  const finishReason =
    message.finish_reason || message.done_reason || data.finish_reason || data.done_reason;

  return {
    content,
    finishReason,
    totalTokens,
    references: references.length > 0 ? references : undefined,
  };
}

/********
 * Misc *
 ********/
export async function listCopilotChatModels(): Promise<ChatModel[]> {
  const { data } = await fetch("https://api.githubcopilot.com/models", {
    method: "GET",
    headers: await prepareHeaders(),
  }).then(
    (res) =>
      res.json() as Promise<{
        data: {
          id: string;
          name: string;
          capabilities: {
            type: string;
            tokenizer: string;
            limits: {
              max_prompt_tokens?: number;
              max_output_tokens?: number;
            };
          };
          policy?: {
            state: string;
          };
          version: string;
        }[];
      }>,
  );

  const allModels = data
    .filter((model) => model.capabilities.type === "chat" && !model.id.endsWith("paygo"))
    .map(({ capabilities: { limits, tokenizer }, id, name, policy, version }) => ({
      id,
      name,
      tokenizer,
      maxInputTokens: limits.max_prompt_tokens,
      maxOutputTokens: limits.max_output_tokens,
      policy: !policy || policy.state === "enabled",
      version,
    }));

  const latestModels = new Map<string, (typeof allModels)[number]>();
  for (const model of allModels) {
    const existingModel = latestModels.get(model.name);
    if (!existingModel || model.version > existingModel.version)
      latestModels.set(model.name, model);
  }

  const models = Array.from(latestModels.values());

  await Promise.all(
    models
      .filter((model) => !model.policy)
      .map(
        async ({ id }) =>
          await fetch("https://api.githubcopilot.com/models/" + id + "/policy", {
            method: "POST",
            headers: await prepareHeaders(),
            body: JSON.stringify({ state: "enabled" }),
          }),
      ),
  );

  return models.map((model) => omit(model, "policy", "version"));
}

/********
 * Chat *
 ********/
/**
 * Send a chat message to Copilot Chat API
 * @param messages Array of messages to send
 * @param options Chat options
 * @param onProgress Optional callback for streaming responses
 * @returns The chat result
 */
async function chat(
  messages: { role: string; content: string }[],
  options: ChatOptions & { signal?: AbortSignal },
  onProgress?: (content: string) => void,
): Promise<ChatResult> {
  const url = "https://api.githubcopilot.com/chat/completions";
  const headers = await prepareHeaders();
  const request = prepareRequest(messages, options);

  const isStream = request.stream;
  const result: ChatResult = {
    content: "",
    finishReason: null,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  if (isStream) {
    await parseSSEStream<ChatStreamResponse>(
      response.body,
      (parsedData) => {
        const contentDelta = parsedData.choices[0]?.delta?.content;
        const finishReason = parsedData.choices[0]?.finish_reason;

        if (contentDelta) {
          result.content += contentDelta;
          onProgress?.(contentDelta);
        }

        if (finishReason) {
          result.finishReason = finishReason;
        }
      },
      (error) => {
        console.error("Error parsing SSE:", error);
      },
      options.signal,
    );
  } else {
    const data = (await response.json()) as ChatResponse;
    const processedData = processResponse(data);

    result.content = processedData.content || "";
    result.finishReason = processedData.finishReason || null;
    result.totalTokens = processedData.totalTokens;
    result.references = processedData.references;

    if (onProgress && result.content) onProgress(result.content);
  }

  return result;
}

/***********
 * Session *
 ***********/
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Represents a chat session (conversation) with GitHub Copilot Chat.
 */
export class ChatSession {
  public readonly id: string;
  public modelId: string;
  public title: string;
  public readonly messages: ChatMessage[];
  public readonly createdAt: number;
  public updatedAt: number;

  // eslint-disable-next-line sonarjs/public-static-readonly
  public static currentDocument = "";

  // Static session storage
  private static instances = new Map<string, ChatSession>();

  /**
   * Create a new {@linkcode ChatSession} instance.
   */
  constructor(modelId: string, systemPrompt = COPILOT_MARKDOWN_INSTRUCTIONS) {
    this.id = generateUUID();
    this.modelId = modelId;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.messages = [];

    // Set title from document content
    this.title = ChatSession.extractTitleFromDocument(ChatSession.currentDocument);

    // Initialize with system prompt
    this.addMessage("system", systemPrompt);

    // Register in session collection
    ChatSession.instances.set(this.id, this);
  }

  /**
   * Create a new session.
   * @param systemPrompt The system prompt to use.
   * @returns A new {@linkcode ChatSession} instance.
   */
  public static create(modelId: string, systemPrompt = COPILOT_MARKDOWN_INSTRUCTIONS): ChatSession {
    return new ChatSession(modelId, systemPrompt);
  }

  /**
   * Get all sessions, sorted by most recent first.
   * @returns An array of {@linkcode ChatSession} instances.
   */
  public static getAll(): ChatSession[] {
    return Array.from(ChatSession.instances.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get a session by ID.
   * @param id The ID of the session.
   * @returns The {@linkcode ChatSession} instance, or `undefined` if not found.
   */
  public static get(id: string): ChatSession | undefined {
    return ChatSession.instances.get(id);
  }

  /**
   * Delete a session.
   * @param id The ID of the session.
   * @returns `true` if deleted, `false` if not found.
   */
  public static delete(id: string): boolean {
    return ChatSession.instances.delete(id);
  }

  /**
   * Send a message in this session.
   * @param message The message to send.
   * @param onProgress Optional callback for streaming responses.
   * @returns The assistant’s response.
   */
  public async send(
    message: string,
    onProgress?: (content: string) => void,
    options?: Partial<ChatOptions> & { signal?: AbortSignal },
  ): Promise<string> {
    // Add user message
    this.addMessage("user", message);

    // Get model - either from options or find best available
    let model = options?.model;
    if (!model) {
      const models = await listCopilotChatModels();
      model =
        models.find((m) => m.id === this.modelId) ||
        models.find((m) => m.id.includes("gpt-4o")) ||
        models[0];
      if (!model) throw new Error("No available models found");
    }

    // Create a temporary messages array with the document context for this API call
    const messagesForAPI = this.messages.concat();
    messagesForAPI[messagesForAPI.length - 1] = {
      role: "user",
      content:
        messagesForAPI[messagesForAPI.length - 1]!.content +
        "\n\n" +
        "<document>\n" +
        "<metadata>\n" +
        `  <title>${this.title}</title>\n` +
        `  <wordCount>${ChatSession.countWords(ChatSession.currentDocument)}</wordCount>\n` +
        `  <charCount>${ChatSession.currentDocument.length}</charCount>\n` +
        "</metadata>\n" +
        ChatSession.extractDocumentStructure(ChatSession.currentDocument) +
        "<content>\n" +
        ChatSession.currentDocument +
        "\n</content>\n" +
        "</document>",
      timestamp: Date.now(),
    };

    // Send the entire session to Copilot
    const result = await chat(
      messagesForAPI,
      {
        model,
        temperature: options?.temperature ?? 0.1,
        signal: options?.signal,
      },
      onProgress,
    );

    // Add the assistant response
    this.addMessage("assistant", result.content);

    return result.content;
  }

  /**
   * Save all sessions to storage.
   */
  public static async saveAll(): Promise<void> {
    const configDir = await getConfigPath();
    if (!configDir) return;

    try {
      const chatDir = path.join(configDir, "typora-copilot", "chat-sessions");
      await fs.mkdir(chatDir, { recursive: true });

      for (const [id, session] of ChatSession.instances) {
        if (session.messages.every((msg) => msg.role === "system")) continue;
        await fs.writeFile(path.join(chatDir, `${id}.json`), JSON.stringify(session, null, 2));
      }

      // Remove unused sessions
      const files = await fs.readDir(chatDir, "filesOnly");
      for (const filename of files) {
        const id = path.basename(filename, ".json");
        if (!ChatSession.instances.has(id)) await fs.rmFile(path.join(chatDir, filename));
      }
    } catch (error) {
      console.error("Failed to save sessions:", error);
    }
  }

  /**
   * Load sessions from storage.
   */
  public static async loadAll(): Promise<void> {
    const configDir = await getConfigPath();
    if (!configDir) return;

    try {
      const chatDir = path.join(configDir, "typora-copilot", "chat-sessions");
      if (!(await fs.accessDir(chatDir))) return;

      const files = await fs.readDir(chatDir, "filesOnly");

      ChatSession.instances.clear();
      for (const file of files) {
        const filePath = path.join(chatDir, file);
        const data = await fs.readFile(filePath);
        const parsed = JSON.parse(data) as ChatSession;
        const id = path.basename(file, ".json");

        // Need to properly reconstruct the session object
        Object.setPrototypeOf(parsed, ChatSession.prototype);
        ChatSession.instances.set(id, parsed);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  }

  /**
   * Add a message to this session.
   */
  private addMessage(role: "system" | "user" | "assistant", content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
    this.updatedAt = Date.now();
  }

  /**
   * Extract a title from document content.
   * @param document The document content.
   * @returns The extracted title.
   */
  private static extractTitleFromDocument(document: string): string {
    let title = "New chat";

    // Try to get title from first heading
    const headingMatch = /^#{1,6}\s+(.+)$/m.exec(document);
    if (headingMatch) {
      title = headingMatch[1]!.substring(0, 30);
      if (title.length < headingMatch[1]!.length) title += "...";
    } else {
      // Fall back to first line if no heading found
      const firstLine = document.split("\n")[0];
      if (firstLine?.trim()) {
        title = firstLine.trim().substring(0, 30);
        if (title.length < firstLine.trim().length) title += "...";
      }
    }

    return title;
  }

  private static countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private static extractDocumentStructure(document: string): string {
    const headings: { level: number; title: string; lineNumber: number }[] = [];
    const lines = document.split("\n");

    lines.forEach((line, index) => {
      const match = /^(#{1,6})\s+(.+)$/.exec(line);
      if (match) {
        headings.push({
          level: match[1]!.length,
          title: match[2]!,
          lineNumber: index + 1,
        });
      }
    });

    if (headings.length === 0) return "";

    let structure = "<structure>\n";
    headings.forEach((h) => {
      structure += `  <heading level="${h.level}" line="${h.lineNumber}">${h.title}</heading>\n`;
    });
    structure += "</structure>\n";

    return structure;
  }
}
