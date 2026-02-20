import type { WebSocket } from 'ws'
import type { ClientMessage, Bid, Suit } from '@67cards/shared'
import type { ConnectedClient } from './types.js'

export interface MessageHandlers {
  joinLobby: (ws: WebSocket, client: ConnectedClient, nickname: string, avatar?: string, odusId?: string) => void
  createTable: (
    ws: WebSocket,
    client: ConnectedClient,
    tableName?: string,
    gameType?: 'euchre' | 'president' | 'spades',
    maxPlayers?: number,
    settings?: {
      superTwosMode?: boolean
      maxRounds?: number
    }
  ) => void
  joinTable: (ws: WebSocket, client: ConnectedClient, tableId: string, seatIndex: number) => void
  leaveTable: (ws: WebSocket, client: ConnectedClient) => void
  leaveGame: (ws: WebSocket, client: ConnectedClient) => void
  startGame: (ws: WebSocket, client: ConnectedClient) => void
  restartGame: (ws: WebSocket, client: ConnectedClient) => void
  makeBid: (ws: WebSocket, client: ConnectedClient, action: Bid['action'], suit?: Suit, goingAlone?: boolean) => void
  playCard: (ws: WebSocket, client: ConnectedClient, cardId: string) => void
  discardCard: (ws: WebSocket, client: ConnectedClient, cardId: string) => void
  requestState: (ws: WebSocket, client: ConnectedClient) => void
  presidentPlayCards: (ws: WebSocket, client: ConnectedClient, cardIds: string[]) => void
  presidentPass: (ws: WebSocket, client: ConnectedClient) => void
  presidentConfirmExchange: (ws: WebSocket, client: ConnectedClient, cardIds: string[]) => void
  spadesMakeBid: (ws: WebSocket, client: ConnectedClient, bidType: 'normal' | 'nil' | 'blind_nil', count: number) => void
  bootPlayer: (ws: WebSocket, client: ConnectedClient, playerId: number) => void
  bugReport: (ws: WebSocket, client: ConnectedClient, payload: string) => void
  chatSend: (ws: WebSocket, client: ConnectedClient, text: string, isQuickReact?: boolean) => void
  unknownMessage: (ws: WebSocket) => void
}

export function routeClientMessage(
  ws: WebSocket,
  client: ConnectedClient,
  message: ClientMessage,
  handlers: MessageHandlers
): void {
  switch (message.type) {
    case 'join_lobby':
      handlers.joinLobby(ws, client, message.nickname, message.avatar, message.odusId)
      break
    case 'create_table':
      handlers.createTable(ws, client, message.tableName, message.gameType, message.maxPlayers, message.settings)
      break
    case 'join_table':
      handlers.joinTable(ws, client, message.tableId, message.seatIndex)
      break
    case 'leave_table':
      handlers.leaveTable(ws, client)
      break
    case 'leave_game':
      handlers.leaveGame(ws, client)
      break
    case 'start_game':
      handlers.startGame(ws, client)
      break
    case 'restart_game':
      handlers.restartGame(ws, client)
      break
    case 'make_bid':
      handlers.makeBid(ws, client, message.action, message.suit, message.goingAlone)
      break
    case 'play_card':
      handlers.playCard(ws, client, message.cardId)
      break
    case 'discard_card':
      handlers.discardCard(ws, client, message.cardId)
      break
    case 'request_state':
      handlers.requestState(ws, client)
      break
    case 'president_play_cards':
      handlers.presidentPlayCards(ws, client, message.cardIds)
      break
    case 'president_pass':
      handlers.presidentPass(ws, client)
      break
    case 'president_confirm_exchange':
      handlers.presidentConfirmExchange(ws, client, message.cardIds)
      break
    case 'spades_make_bid':
      handlers.spadesMakeBid(ws, client, message.bidType, message.count)
      break
    case 'boot_player':
      handlers.bootPlayer(ws, client, message.playerId)
      break
    case 'bug_report':
      handlers.bugReport(ws, client, message.payload)
      break
    case 'chat_send':
      handlers.chatSend(ws, client, message.text, message.isQuickReact)
      break
    default:
      handlers.unknownMessage(ws)
  }
}