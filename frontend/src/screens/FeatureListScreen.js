import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import EmptyState from '../components/EmptyState'
import Message from '../components/Message'
import AutoPilotControls from '../components/AutoPilotControls'
import { listFeatures, updateFeature } from '../actions/featureActions'
import './FeatureListScreen.css'

const TABLE_COL_COUNT = 6

const STATUS_BADGE_CLASS = {
  Enabled: 'fd-badge fd-badge--enabled',
  Testing: 'fd-badge fd-badge--testing',
  Disabled: 'fd-badge fd-badge--disabled',
}

const SearchIcon = () => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    aria-hidden='true'
  >
    <circle cx='11' cy='11' r='7' />
    <line x1='21' y1='21' x2='16.65' y2='16.65' />
  </svg>
)

const SkeletonRow = () => (
  <tr>
    <td>
      <span className='fd-skeleton-cell' />
      <br />
      <span className='fd-skeleton-cell' style={{ width: '40%', marginTop: 4 }} />
    </td>
    {[0, 1, 2, 3, 4].map((i) => (
      <td key={i}>
        <span className='fd-skeleton-cell' />
      </td>
    ))}
  </tr>
)

const FeatureRow = ({ feature, busy, expanded, onToggleExpand }) => {
  const dispatch = useDispatch()
  const [localTraffic, setLocalTraffic] = useState(feature.traffic_percentage)
  const debounceRef = useRef(null)

  useEffect(() => {
    setLocalTraffic(feature.traffic_percentage)
  }, [feature.traffic_percentage])

  const handleSlider = (e) => {
    const value = Number(e.target.value)
    setLocalTraffic(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      dispatch(updateFeature(feature.key, { traffic_percentage: value }))
    }, 150)
  }

  const handleToggle = () => {
    const nextStatus = feature.status === 'Enabled' ? 'Disabled' : 'Enabled'
    dispatch(updateFeature(feature.key, { status: nextStatus }))
  }

  const handleAutoPilotUpdate = (currentState) => {
    const patch = {}
    if (currentState.status) patch.status = currentState.status
    if (typeof currentState.traffic_percentage === 'number') {
      patch.traffic_percentage = currentState.traffic_percentage
    }
    if (Object.keys(patch).length > 0) {
      dispatch(updateFeature(feature.key, patch))
    }
  }

  const triggerId = `fd-ap-trigger-${feature.key}`
  const panelId = `fd-ap-panel-${feature.key}`

  return (
    <>
      <tr
        className={busy ? 'fd-row--busy' : undefined}
        aria-busy={busy || undefined}
      >
        <td>
          <span className='fd-feature-name'>{feature.name}</span>
          <span className='fd-feature-key'>{feature.key}</span>
        </td>
        <td>
          <span className={STATUS_BADGE_CLASS[feature.status]}>
            {feature.status}
          </span>
        </td>
        <td>
          <div className='fd-slider-cell'>
            <input
              type='range'
              className='fd-slider'
              min={0}
              max={100}
              value={localTraffic}
              onChange={handleSlider}
              aria-label={`Traffic percentage for ${feature.name}`}
            />
            <span className='fd-slider-value' aria-live='polite'>
              {localTraffic}%
            </span>
          </div>
        </td>
        <td className='fd-mono'>{feature.last_modified}</td>
        <td className='fd-toggle-cell'>
          <label className='fd-switch'>
            <input
              type='checkbox'
              checked={feature.status === 'Enabled'}
              onChange={handleToggle}
              aria-label={`Enable ${feature.name}`}
            />
            <span className='fd-switch-track' />
          </label>
        </td>
        <td className='fd-ap-cell'>
          <button
            type='button'
            id={triggerId}
            className='fd-ap-trigger'
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={onToggleExpand}
          >
            {expanded ? 'Свернуть' : 'Auto-Pilot'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className='fd-ap-row'>
          <td colSpan={TABLE_COL_COUNT} id={panelId} role='region' aria-labelledby={triggerId}>
            <AutoPilotControls feature={feature} onUpdate={handleAutoPilotUpdate} />
          </td>
        </tr>
      )}
    </>
  )
}

const FeatureListScreen = ({ history }) => {
  const dispatch = useDispatch()
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const featureList = useSelector((state) => state.featureList)
  const { loading, error, features, updatingKey, updateError } = featureList

  const [expandedKey, setExpandedKey] = useState(null)
  const handleToggleExpand = (key) =>
    setExpandedKey((prev) => (prev === key ? null : key))

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listFeatures())
    } else {
      history.push('/login')
    }
  }, [dispatch, history, userInfo])

  const filtered = useMemo(() => {
    return (features || [])
      .filter(
        (f) =>
          keyword === '' ||
          f.name.toLowerCase().includes(keyword.toLowerCase())
      )
      .filter((f) => statusFilter === 'All' || f.status === statusFilter)
  }, [features, keyword, statusFilter])

  const totalCount = (features || []).length
  const showFilteredEmpty =
    !loading && !error && filtered.length === 0 && totalCount > 0
  const showInventoryEmpty =
    !loading && !error && totalCount === 0
  const showTable = !showFilteredEmpty && !showInventoryEmpty

  return (
    <div className='feature-dashboard'>
      <div className='fd-header'>
        <div>
          <h1>Feature Dashboard</h1>
          <p className='fd-subtitle'>
            Manage feature flag rollouts and traffic ramps.
          </p>
        </div>
        <div className='fd-count-chip'>
          <span className='fd-dot' />
          {totalCount} FLAGS
        </div>
      </div>

      <div className='fd-filters'>
        <input
          type='text'
          className='fd-input fd-search'
          placeholder='Search by name...'
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label='Search features by name'
        />
        <select
          className='fd-input fd-select'
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label='Filter by status'
        >
          <option value='All'>All</option>
          <option value='Enabled'>Enabled</option>
          <option value='Testing'>Testing</option>
          <option value='Disabled'>Disabled</option>
        </select>
      </div>

      {updateError && <Message variant='warning'>{updateError}</Message>}

      {error ? (
        <Message variant='danger'>{error}</Message>
      ) : showTable ? (
        <div className='fd-table-wrap'>
          <table className='fd-table'>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Traffic %</th>
                <th>Last modified</th>
                <th className='fd-th-right'>Toggle</th>
                <th className='fd-th-autopilot'>Auto-Pilot</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)
                : filtered.map((f) => (
                    <FeatureRow
                      key={f.key}
                      feature={f}
                      busy={updatingKey === f.key}
                      expanded={expandedKey === f.key}
                      onToggleExpand={() => handleToggleExpand(f.key)}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showFilteredEmpty && (
        <EmptyState
          icon={<SearchIcon />}
          heading='No features match your filters.'
          subtitle='Try a different keyword or clear the status filter.'
        />
      )}

      {showInventoryEmpty && (
        <EmptyState
          icon={<SearchIcon />}
          heading='No feature flags yet.'
          subtitle='Once features are seeded, they appear here.'
        />
      )}
    </div>
  )
}

export default FeatureListScreen
