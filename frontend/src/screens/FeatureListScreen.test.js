import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore, combineReducers } from 'redux'
import { MemoryRouter } from 'react-router-dom'
import FeatureListScreen from './FeatureListScreen'
import { featureListReducer } from '../reducers/featureReducers'
import { updateFeature } from '../actions/featureActions'

// Stub the action creators so mount-time dispatch doesn't reset the prepopulated
// featureList state we set up in buildStore. The thunk would fire FEATURE_LIST_REQUEST
// (which clears the features array) before our assertions run.
jest.mock('../actions/featureActions', () => ({
  listFeatures: jest.fn(() => ({ type: 'TEST_NOOP' })),
  updateFeature: jest.fn(() => ({ type: 'TEST_NOOP' })),
}))

const sampleFeatures = [
  {
    key: 'search_v2',
    name: 'New Search Algorithm',
    status: 'Testing',
    traffic_percentage: 25,
    last_modified: '2026-05-03',
  },
  {
    key: 'cart_redesign',
    name: 'Redesigned Cart UI',
    status: 'Disabled',
    traffic_percentage: 0,
    last_modified: '2026-04-01',
  },
  {
    key: 'paypal_express_buttons',
    name: 'PayPal Express Checkout Buttons',
    status: 'Enabled',
    traffic_percentage: 100,
    last_modified: '2026-01-08',
  },
]

const userLoginInitial = { userInfo: { isAdmin: true, token: 't' } }

const buildStore = (features) =>
  createStore(
    combineReducers({
      featureList: featureListReducer,
      userLogin: (state = userLoginInitial) => state,
    }),
    {
      featureList: { loading: false, features },
      userLogin: userLoginInitial,
    }
  )

const renderScreen = (features = sampleFeatures) => {
  const store = buildStore(features)
  const history = { push: jest.fn() }
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <FeatureListScreen history={history} />
      </MemoryRouter>
    </Provider>
  )
}

describe('FeatureListScreen', () => {
  it('renders one row per feature', () => {
    const { getByText } = renderScreen()
    expect(getByText('New Search Algorithm')).toBeInTheDocument()
    expect(getByText('Redesigned Cart UI')).toBeInTheDocument()
    expect(getByText('PayPal Express Checkout Buttons')).toBeInTheDocument()
  })

  it('filters by name via the search input', () => {
    const { getByLabelText, queryByText } = renderScreen()
    fireEvent.change(getByLabelText('Search features by name'), {
      target: { value: 'cart' },
    })
    expect(queryByText('Redesigned Cart UI')).toBeInTheDocument()
    expect(queryByText('New Search Algorithm')).not.toBeInTheDocument()
    expect(queryByText('PayPal Express Checkout Buttons')).not.toBeInTheDocument()
  })

  it('filters by status', () => {
    const { getByLabelText, queryByText } = renderScreen()
    fireEvent.change(getByLabelText('Filter by status'), {
      target: { value: 'Testing' },
    })
    expect(queryByText('New Search Algorithm')).toBeInTheDocument()
    expect(queryByText('Redesigned Cart UI')).not.toBeInTheDocument()
    expect(queryByText('PayPal Express Checkout Buttons')).not.toBeInTheDocument()
  })

  it('shows the empty-filter message when nothing matches', () => {
    const { getByLabelText, getByText } = renderScreen()
    fireEvent.change(getByLabelText('Search features by name'), {
      target: { value: 'zzznotreal' },
    })
    expect(getByText(/No features match your filters/i)).toBeInTheDocument()
  })
})

describe('FeatureListScreen — rollback on update failure', () => {
  it('shows warning and restores prev state when FEATURE_UPDATE_FAIL fires', () => {
    const store = buildStore(sampleFeatures)
    const { getByText, rerender, container } = render(
      <Provider store={store}>
        <MemoryRouter>
          <FeatureListScreen history={{ push: jest.fn() }} />
        </MemoryRouter>
      </Provider>
    )

    // cart_redesign starts Disabled. Optimistically flip it Enabled:
    store.dispatch({
      type: 'FEATURE_UPDATE_REQUEST',
      payload: {
        key: 'cart_redesign',
        patch: { status: 'Enabled' },
        prev: sampleFeatures.find((f) => f.key === 'cart_redesign'),
      },
    })
    rerender(
      <Provider store={store}>
        <MemoryRouter>
          <FeatureListScreen history={{ push: jest.fn() }} />
        </MemoryRouter>
      </Provider>
    )

    // Now simulate server failure
    store.dispatch({
      type: 'FEATURE_UPDATE_FAIL',
      payload: {
        key: 'cart_redesign',
        prev: sampleFeatures.find((f) => f.key === 'cart_redesign'),
        error: 'boom',
      },
    })
    rerender(
      <Provider store={store}>
        <MemoryRouter>
          <FeatureListScreen history={{ push: jest.fn() }} />
        </MemoryRouter>
      </Provider>
    )

    // The warning message renders
    expect(getByText('boom')).toBeInTheDocument()
    // And the Disabled badge count includes cart_redesign again
    // (sampleFeatures has exactly one Disabled feature — cart_redesign)
    expect(container.querySelectorAll('.fd-badge--disabled').length).toBe(1)
  })
})

describe('FeatureListScreen — persistence wiring', () => {
  beforeEach(() => {
    updateFeature.mockClear()
  })

  it('dispatches updateFeature with status patch on toggle', () => {
    const { getByLabelText } = renderScreen()
    fireEvent.click(getByLabelText('Enable Redesigned Cart UI'))
    expect(updateFeature).toHaveBeenCalledWith('cart_redesign', { status: 'Enabled' })
  })

  it('dispatches updateFeature with traffic patch after slider debounce', () => {
    jest.useFakeTimers()
    const { getByLabelText } = renderScreen()
    fireEvent.change(getByLabelText('Traffic percentage for New Search Algorithm'), {
      target: { value: '60' },
    })
    jest.advanceTimersByTime(200)
    expect(updateFeature).toHaveBeenCalledWith('search_v2', { traffic_percentage: 60 })
    jest.useRealTimers()
  })
})
