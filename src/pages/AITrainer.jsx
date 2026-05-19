import { useState, useRef, useEffect } from 'react'
import {
  Bot, Send, Trash2, Copy, Check, Zap, User,
  MessageSquare, Sparkles, ChevronDown
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { sendChatMessage } from '../services/groqApi'
import { useAuth } from '../context/AuthContext'
import { getChatMessages, saveChatMessage, clearChatMessages } from '../services/dbService'

const SUGGESTED_PROMPTS = [
  { icon: '💪', text: 'Crie um plano de treino para iniciante de 3 dias por semana' },
  { icon: '🧠', text: 'Como montar uma rotina semanal de treino sem overtraining?' },
  { icon: '🏋️', text: 'Como fazer o agachamento corretamente?' },
  { icon: '⚡', text: 'Quais exercícios são melhores para perder gordura abdominal?' },
  { icon: '💤', text: 'Qual a importância do descanso no processo de ganho de massa?' },
  { icon: '📈', text: 'Como progredir carga de forma segura no supino e no agachamento?' },
  { icon: '🔥', text: 'Me monte um treino HIIT para fazer em casa sem equipamento' },
  { icon: '📊', text: 'Como estruturar deload sem perder desempenho?' },
]

function formatMessage(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h3 class="text-jp-orange font-bold text-base mt-3 mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-white font-bold text-lg mt-4 mb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-white font-black text-xl mt-4 mb-2">$1</h1>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 text-jp-gray-light list-disc list-inside">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 text-jp-gray-light list-decimal list-inside"><span class="text-jp-orange font-bold">$1.</span> $2</li>')
    .replace(/\n/g, '<br />')
}

function ChatBubble({ message, onCopy }) {
  const [copied, setCopied] = useState(false)
  const isBot = message.role === 'assistant'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy?.()
  }

  return (
    <div className={`flex gap-3 ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isBot ? 'bg-gradient-orange shadow-orange' : 'bg-jp-card-light border border-jp-border'
      }`}>
        {isBot ? <Zap size={16} className="text-white" /> : <User size={16} className="text-jp-gray" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] group ${isBot ? '' : 'items-end'}`}>
        <div className={`rounded-2xl px-4 py-3 relative ${
          isBot
            ? 'bg-jp-card border border-jp-border rounded-tl-none text-jp-gray-light'
            : 'bg-jp-orange text-white rounded-tr-none'
        }`}>
          {isBot ? (
            <div
              className="text-sm leading-relaxed prose-sm"
              dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
            />
          ) : (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
        </div>

        {/* Copy button */}
        {isBot && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-jp-gray hover:text-jp-orange text-xs mt-1.5 transition-colors"
          >
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        )}

        <p className="text-jp-gray text-xs mt-1 px-1">
          {message.time}
        </p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-9 h-9 rounded-xl bg-gradient-orange flex items-center justify-center flex-shrink-0 shadow-orange">
        <Zap size={16} className="text-white" />
      </div>
      <div className="bg-jp-card border border-jp-border rounded-2xl rounded-tl-none px-4 py-3">
        <div className="flex gap-1.5 items-center h-5">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </div>
  )
}

export default function AITrainer() {
  const { user } = useAuth()
  const INITIAL_MSG = {
    role: 'assistant',
    content: 'Olá! Sou o **JPFitness AI**, seu treinador pessoal virtual! 💪\n\nPosso te ajudar com:\n- Planos de treino personalizados\n- Técnica e execução de exercícios\n- Motivação e estratégias de progresso\n- Organização da rotina de treino\n\nComo posso te ajudar hoje?',
    time: 'Agora'
  }
  const [messages, setMessages] = useState([INITIAL_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Load chat history from Supabase on mount
  useEffect(() => {
    if (!user) return
    getChatMessages(user.id)
      .then(history => {
        if (history?.length > 0) {
          const formatted = history.map(m => ({
            role: m.role,
            content: m.content,
            time: new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }))
          setMessages([INITIAL_MSG, ...formatted])
        }
      })
      .catch(console.error)
  }, [user])

  const handleScroll = () => {
    if (!chatContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100)
  }

  const getTime = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const sendMessage = async (text) => {
    const content = (text || input).trim()
    if (!content || loading) return

    const userMsg = { role: 'user', content, time: getTime() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const apiMessages = newMessages
        .filter(m => m.role !== undefined)
        .map(({ role, content }) => ({ role, content }))

      const reply = await sendChatMessage(apiMessages)
      const assistantMsg = { role: 'assistant', content: reply, time: getTime() }
      setMessages(prev => [...prev, assistantMsg])
      if (user) {
        await saveChatMessage(user.id, 'user', content).catch(console.error)
        await saveChatMessage(user.id, 'assistant', reply).catch(console.error)
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Desculpe, ocorreu um erro ao processar sua mensagem. Verifique sua conexão e tente novamente.',
        time: getTime()
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = async () => {
    if (user) await clearChatMessages(user.id).catch(console.error)
    setMessages([{
      role: 'assistant',
      content: 'Conversa reiniciada! Como posso te ajudar? 💪',
      time: getTime()
    }])
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-jp-dark/95 backdrop-blur-md border-b border-jp-border px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-orange rounded-xl flex items-center justify-center shadow-orange">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                JPFitness AI
                <span className="badge-orange text-xs">Tecnologia de IA</span>
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Ativo • Responde em segundos
              </div>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="flex items-center gap-2 text-jp-gray hover:text-white text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-jp-border"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Limpar</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden max-w-5xl w-full mx-auto flex flex-col px-4 sm:px-6 lg:px-8">
        {/* Suggested prompts - show only when only initial message */}
        {messages.length === 1 && (
          <div className="py-4 flex-shrink-0">
            <p className="text-jp-gray text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles size={12} className="text-jp-orange" />
              Sugestões rápidas
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_PROMPTS.map(({ icon, text }) => (
                <button
                  key={text}
                  onClick={() => sendMessage(text)}
                  className="flex items-center gap-3 text-left bg-jp-card hover:bg-jp-card-light border border-jp-border hover:border-jp-orange/40 rounded-xl p-3 transition-all duration-200 group"
                >
                  <span className="text-xl flex-shrink-0">{icon}</span>
                  <span className="text-jp-gray-light text-sm group-hover:text-white transition-colors leading-snug">{text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto py-4 space-y-4 scroll-smooth"
        >
          {messages.map((msg, i) => (
            <ChatBubble key={i} message={msg} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollDown && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-28 right-8 w-9 h-9 bg-jp-card border border-jp-border rounded-full flex items-center justify-center text-jp-gray hover:text-white hover:border-jp-orange transition-all shadow-card"
          >
            <ChevronDown size={16} />
          </button>
        )}

        {/* Input */}
        <div className="py-4 flex-shrink-0 border-t border-jp-border">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte qualquer coisa sobre treino..."
                rows={1}
                disabled={loading}
                className="input-dark resize-none py-3 pr-4 leading-relaxed max-h-32 overflow-y-auto"
                style={{ minHeight: '48px' }}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                }}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-12 h-12 bg-jp-orange hover:bg-jp-orange-dark disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
              style={{ boxShadow: input.trim() ? '0 4px 15px rgba(255,98,0,0.4)' : 'none' }}
            >
              {loading ? <LoadingSpinner size="sm" /> : <Send size={18} className="text-white" />}
            </button>
          </div>
          <p className="text-jp-gray text-xs mt-2 text-center">
            Enter para enviar • Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
  )
}
