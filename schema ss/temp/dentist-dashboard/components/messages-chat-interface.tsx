"use client"

import React from "react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { ConversationList } from "@/components/conversation-list"
import { ConversationView } from "@/components/conversation-view"

export function MessagesChatInterface() {
  const [selectedConversationId, setSelectedConversationId] = React.useState<string>()

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId)
  }

  const handleSendMessage = (message: string) => {
    console.log("[v0] Sending message:", message)
  }

  return (
    <div className="h-full bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
          <div className="h-full border-r border-border">
            <ConversationList
              selectedConversationId={selectedConversationId}
              onConversationSelect={handleConversationSelect}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={65} minSize={50}>
          <ConversationView
            conversation={
              selectedConversationId
                ? {
                    id: selectedConversationId,
                    patientName: "Sarah Johnson",
                    patientUhid: "UH001234",
                    status: "urgent",
                    messages: [
                      {
                        id: "1",
                        sender: "patient",
                        content:
                          "Hello Dr. Smith, I'm experiencing severe pain in my upper left molar. It started yesterday evening and has been getting worse.",
                        timestamp: "10:30 AM",
                        status: "read",
                      },
                      {
                        id: "2",
                        sender: "dentist",
                        content:
                          "I'm sorry to hear about your pain, Sarah. Can you describe the type of pain? Is it sharp, throbbing, or constant?",
                        timestamp: "10:35 AM",
                        status: "read",
                      },
                      {
                        id: "3",
                        sender: "patient",
                        content:
                          "It's a throbbing pain that gets worse when I bite down or drink something cold. I also notice some swelling around the gum area.",
                        timestamp: "10:37 AM",
                        status: "read",
                      },
                      {
                        id: "4",
                        sender: "patient",
                        content: "Should I come in for an emergency appointment? The pain is really bothering me.",
                        timestamp: "2 min ago",
                        status: "delivered",
                      },
                    ],
                  }
                : undefined
            }
            onSendMessage={handleSendMessage}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
