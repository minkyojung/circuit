/**
 * Event Broadcaster
 *
 * Utility class for broadcasting events to all renderer processes
 * Used for event-driven architecture to eliminate polling
 */

import { BrowserWindow } from 'electron'

export class EventBroadcaster {
  /**
   * Broadcast an event to all renderer processes
   */
  static broadcast(channel: string, data: any): void {
    const allWindows = BrowserWindow.getAllWindows()

    for (const window of allWindows) {
      if (!window.isDestroyed() && window.webContents) {
        window.webContents.send(channel, data)
      }
    }
  }

  /**
   * Broadcast todos change event
   * Used when todos are created, updated, or deleted
   */
  static broadcastTodosChanged(conversationId: string, messageId: string): void {
    console.log('[EventBroadcaster] Broadcasting todos:changed', {
      conversationId,
      messageId,
    })

    this.broadcast('todos:changed', {
      conversationId,
      messageId,
      timestamp: Date.now(),
    })
  }

  /**
   * Broadcast todo deleted event
   * Used when a specific todo is deleted
   */
  static broadcastTodoDeleted(todoId: string, conversationId: string, messageId: string): void {
    console.log('[EventBroadcaster] Broadcasting todos:deleted', {
      todoId,
      conversationId,
      messageId,
    })

    this.broadcast('todos:deleted', {
      todoId,
      conversationId,
      messageId,
      timestamp: Date.now(),
    })
  }
}
