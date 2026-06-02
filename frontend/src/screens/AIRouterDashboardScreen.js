import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Table, Badge, Row, Col, Card } from 'react-bootstrap'
import Message from '../components/Message'
import Loader from '../components/Loader'
import { listChatLogs } from '../actions/assistantActions'

const AIRouterDashboardScreen = ({ history }) => {
  const dispatch = useDispatch()

  const { userInfo } = useSelector((state) => state.userLogin)
  const { loading, error, logs } = useSelector((state) => state.chatLogList)

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listChatLogs())
    } else {
      history.push('/login')
    }
  }, [dispatch, history, userInfo])

  const total = logs ? logs.length : 0
  const localCount = logs ? logs.filter((l) => l.route === 'local').length : 0
  const cloudCount = total - localCount
  const saved = logs
    ? logs
        .filter((l) => l.route === 'local')
        .reduce((s, l) => s + (l.costUsd || 0.002), 0)
        .toFixed(4)
    : 0

  return (
    <>
      <h1>AI Router Dashboard</h1>
      <Row className='mb-3'>
        <Col><Card body>Всего: {total}</Card></Col>
        <Col><Card body>Local: {localCount}</Card></Col>
        <Col><Card body>Cloud: {cloudCount}</Card></Col>
        <Col><Card body>Экономия ~${saved}</Card></Col>
      </Row>
      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <Table striped bordered hover responsive size='sm'>
          <thead>
            <tr>
              <th>Время</th><th>Юзер</th><th>Сообщение</th><th>PII</th>
              <th>Маршрут</th><th>Модель</th><th>Латентность</th><th>$</th><th>Ответ</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l._id} className={l.route === 'local' ? 'table-success' : ''}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.userName}</td>
                <td>{l.message}</td>
                <td>{(l.piiEntities || []).join(', ')}</td>
                <td>
                  <Badge variant={l.route === 'local' ? 'success' : 'info'}>
                    {l.route}
                  </Badge>
                </td>
                <td>{l.model}</td>
                <td>{l.latencyMs} ms</td>
                <td>${(l.costUsd || 0).toFixed(4)}</td>
                <td>{(l.reply || '').slice(0, 80)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}

export default AIRouterDashboardScreen
