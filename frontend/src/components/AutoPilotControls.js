import React, { useState } from 'react'

const N8N_URL = process.env.REACT_APP_N8N_WEBHOOK_URL || ''
const N8N_API_KEY = process.env.REACT_APP_N8N_API_KEY || ''

const Spinner = () => <span className='fd-ap-spinner' aria-hidden='true' />

const ACTIONS = [
  {
    key: 'check',
    label: 'Запустить проверку',
    busyLabel: 'Проверяем…',
    variant: 'secondary',
    extras: () => ({}),
  },
  {
    key: 'test',
    label: 'Тестовый режим',
    busyLabel: 'Включаем…',
    variant: 'info',
    extras: () => ({ target_state: 'Testing' }),
  },
  {
    key: 'rollback',
    label: 'Откатить фичу',
    busyLabel: 'Откатываем…',
    variant: 'danger',
    extras: () => ({ target_state: 'Disabled' }),
  },
]

const AutoPilotControls = ({ feature, onUpdate }) => {
  const [loading, setLoading] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const callAutoPilot = async (action, extras) => {
    if (!N8N_URL) {
      setFeedback({
        type: 'error',
        message:
          'REACT_APP_N8N_WEBHOOK_URL не задан. Пропишите в frontend/.env и перезапустите dev-server.',
      })
      return
    }

    setLoading(action)
    setFeedback(null)
    try {
      const response = await fetch(`${N8N_URL}/feature-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': N8N_API_KEY,
        },
        body: JSON.stringify({
          feature_id: feature.key,
          action,
          ...extras,
        }),
      })

      const contentType = response.headers.get('content-type') || ''
      const result = contentType.includes('application/json')
        ? await response.json()
        : { success: false, message: `HTTP ${response.status} ${response.statusText}` }

      if (!response.ok || result.success === false) {
        setFeedback({
          type: 'error',
          message: result.message || `HTTP ${response.status}`,
        })
        return
      }

      setFeedback({ type: 'success', message: result.message })
      if (result.current_state) onUpdate(result.current_state)
    } catch (e) {
      setFeedback({ type: 'error', message: `Сеть: ${e.message}` })
    } finally {
      setLoading(null)
    }
  }

  const busy = loading !== null

  return (
    <div className='fd-ap' aria-label='Auto-Pilot Controls'>
      <div className='fd-ap-header'>
        <h3 className='fd-ap-title'>Auto-Pilot</h3>
        <span className='fd-ap-feature'>{feature.name}</span>
      </div>

      <div className='fd-ap-actions'>
        {ACTIONS.map(({ key, label, busyLabel, variant, extras }) => (
          <button
            key={key}
            type='button'
            className={`fd-ap-btn fd-ap-btn--${variant}`}
            onClick={() => callAutoPilot(key, extras())}
            disabled={busy}
          >
            {loading === key ? (
              <>
                <Spinner /> {busyLabel}
              </>
            ) : (
              label
            )}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`fd-ap-alert fd-ap-alert--${feedback.type}`}
          role='alert'
          aria-live='polite'
        >
          {feedback.message}
        </div>
      )}
    </div>
  )
}

export default AutoPilotControls
