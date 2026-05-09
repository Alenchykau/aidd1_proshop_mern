import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Table, Form, Badge, Row, Col } from 'react-bootstrap'
import Message from '../components/Message'
import {
  listFeatures,
  toggleFeature,
  updateFeatureTraffic,
} from '../actions/featureActions'

// The project ships a custom Bootswatch theme that redefines --primary (black) and
// --secondary (white), so the natural Bootstrap variants don't read as the spec's
// "blue / grey" badges. We pick info for Testing and override Disabled inline to a
// light grey since no built-in variant in this theme renders that way.
const STATUS_BADGE = {
  Enabled: { variant: 'success' },
  Testing: { variant: 'info' },
  Disabled: {
    variant: 'light',
    style: { backgroundColor: '#adb5bd', color: '#212529' },
  },
}

const SkeletonRow = () => (
  <tr>
    {[0, 1, 2, 3, 4].map((i) => (
      <td key={i}>
        <span
          style={{
            display: 'inline-block',
            width: '80%',
            height: '1rem',
            backgroundColor: '#e9ecef',
            borderRadius: '0.25rem',
          }}
        />
      </td>
    ))}
  </tr>
)

const FeatureRow = ({ feature }) => {
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
      dispatch(updateFeatureTraffic(feature.key, value))
    }, 150)
  }

  const handleToggle = () => {
    dispatch(toggleFeature(feature.key))
  }

  return (
    <tr>
      <td>{feature.name}</td>
      <td>
        <Badge {...STATUS_BADGE[feature.status]}>{feature.status}</Badge>
      </td>
      <td>
        <Form.Control
          type='range'
          min={0}
          max={100}
          value={localTraffic}
          onChange={handleSlider}
          aria-label={`Traffic percentage for ${feature.name}`}
        />
        <span aria-live='polite'>{localTraffic}%</span>
      </td>
      <td>{feature.last_modified}</td>
      <td>
        <Form.Check
          type='switch'
          id={`toggle-${feature.key}`}
          label={`Enable ${feature.name}`}
          checked={feature.status === 'Enabled'}
          onChange={handleToggle}
        />
      </td>
    </tr>
  )
}

const FeatureListScreen = ({ history }) => {
  const dispatch = useDispatch()
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const featureList = useSelector((state) => state.featureList)
  const { loading, error, features } = featureList

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

  const renderBody = () => {
    if (loading) {
      return [0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)
    }
    if (filtered.length === 0) {
      return null
    }
    return filtered.map((f) => <FeatureRow key={f.key} feature={f} />)
  }

  return (
    <>
      <h1>Feature Dashboard</h1>
      <Row className='mb-3'>
        <Col md={8}>
          <Form.Control
            type='text'
            placeholder='Search by name...'
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label='Search features by name'
          />
        </Col>
        <Col md={4}>
          <Form.Control
            as='select'
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label='Filter by status'
          >
            <option value='All'>All</option>
            <option value='Enabled'>Enabled</option>
            <option value='Testing'>Testing</option>
            <option value='Disabled'>Disabled</option>
          </Form.Control>
        </Col>
      </Row>

      {error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <>
          <Table striped bordered hover responsive className='table-sm'>
            <thead>
              <tr>
                <th>NAME</th>
                <th>STATUS</th>
                <th>TRAFFIC %</th>
                <th>LAST MODIFIED</th>
                <th>TOGGLE</th>
              </tr>
            </thead>
            <tbody>{renderBody()}</tbody>
          </Table>
          {!loading && filtered.length === 0 && (features || []).length > 0 && (
            <Message variant='info'>No features match your filters.</Message>
          )}
          {!loading && (features || []).length === 0 && !error && (
            <Message variant='info'>No feature flags found.</Message>
          )}
        </>
      )}
    </>
  )
}

export default FeatureListScreen
