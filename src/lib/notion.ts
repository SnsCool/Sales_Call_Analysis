import { Client } from "@notionhq/client"

let notionClient: Client | null = null

function getNotionClient(): Client | null {
  if (!process.env.NOTION_API_KEY) {
    return null
  }

  if (!notionClient) {
    notionClient = new Client({
      auth: process.env.NOTION_API_KEY,
    })
  }

  return notionClient
}

interface AppendFeedbackParams {
  pageId: string
  recordingTopic: string
  feedbackContent: string
  sharedAt: string
}

/**
 * Notionページにフィードバックを追記する
 */
export async function appendFeedbackToNotion(params: AppendFeedbackParams): Promise<boolean> {
  const notion = getNotionClient()
  if (!notion) {
    console.log("[Notion] API key not configured, skipping")
    return false
  }

  try {
    await notion.blocks.children.append({
      block_id: params.pageId,
      children: [
        {
          object: "block",
          type: "divider",
          divider: {},
        },
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: `フィードバック: ${params.recordingTopic}`,
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: `共有日時: ${new Date(params.sharedAt).toLocaleString("ja-JP")}`,
                },
                annotations: {
                  color: "gray",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: params.feedbackContent,
                },
              },
            ],
          },
        },
      ],
    })

    return true
  } catch (error) {
    console.error("[Notion] Failed to append feedback:", error)
    return false
  }
}

interface CreateFeedbackPageParams {
  databaseId: string
  userName: string
  recordingTopic: string
  feedbackContent: string
  sharedAt: string
}

/**
 * NotionデータベースにフィードバックページをCreate
 */
export async function createFeedbackPage(params: CreateFeedbackPageParams): Promise<string | null> {
  const notion = getNotionClient()
  if (!notion) {
    console.log("[Notion] API key not configured, skipping")
    return null
  }

  try {
    const response = await notion.pages.create({
      parent: {
        database_id: params.databaseId,
      },
      properties: {
        // データベースのプロパティ名に合わせて調整が必要
        Name: {
          title: [
            {
              text: {
                content: `[${params.userName}] ${params.recordingTopic}`,
              },
            },
          ],
        },
        Date: {
          date: {
            start: params.sharedAt,
          },
        },
      },
      children: [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "フィードバック内容",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: params.feedbackContent,
                },
              },
            ],
          },
        },
      ],
    })

    return response.id
  } catch (error) {
    console.error("[Notion] Failed to create page:", error)
    return null
  }
}
