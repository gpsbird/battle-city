import AIWorkerSaga from 'ai/AIWorkerSaga'
import { Repeat } from 'immutable'
import { State } from 'reducers'
import { channel as makeChannel } from 'redux-saga'
import { all, cancelled, fork, put, race, select, take, takeEvery } from 'redux-saga/effects'
import { spawnTank } from 'sagas/common'
import { explosionFromTank, scoreFromKillTank } from 'sagas/common/destroyTanks'
import { PlayerRecord, TankRecord } from 'types'
import { getNextId } from 'utils/common'
import {
  AI_SPAWN_SPEED_MAP,
  MAX_AI_TANK_COUNT,
  TANK_INDEX_THAT_WITH_POWER_UP,
} from 'utils/constants'
import * as selectors from 'utils/selectors'
import { frame } from 'utils/common'

/** AIMasterSaga用来管理AIWorkerSaga的启动和停止, 并处理和AI程序的数据交互 */
export default function* AIMasterSaga() {
  const addAIReqChannel = makeChannel<'add'>()
  yield fork(addWorkerHelper)

  while (true) {
    yield take('START_STAGE')
    Repeat<'add'>('add', MAX_AI_TANK_COUNT).forEach(addAIReqChannel.put)
  }

  function* addWorkerHelper() {
    while (true) {
      yield take(addAIReqChannel)
      const { game, stages }: State = yield select()
      if (!game.remainingEnemies.isEmpty()) {
        const { x, y } = yield select(selectors.availableSpawnPosition)
        yield put<Action>({ type: 'REMOVE_FIRST_REMAINING_ENEMY' })
        const level = game.remainingEnemies.first()
        const hp = level === 'armor' ? 4 : 1
        const tankId = getNextId('tank')
        yield spawnTank(
          new TankRecord({
            tankId,
            x,
            y,
            side: 'ai',
            level,
            hp,
            withPowerUp: TANK_INDEX_THAT_WITH_POWER_UP.includes(20 - game.remainingEnemies.count()),
            helmetDuration: frame(30),
            frozenTimeout: game.AIFrozenTimeout,
          }),
          AI_SPAWN_SPEED_MAP[stages.find(s => s.name === game.currentStageName).difficulty],
        )
        yield fork(AIWorkerWrapper, `AI-${getNextId('AI-player')}`, tankId)
      }
    }
  }

  function* AIWorkerWrapper(playerName: string, tankId: TankId) {
    try {
      yield put<Action>({
        type: 'ADD_PLAYER',
        player: new PlayerRecord({
          playerName,
          lives: Infinity,
          side: 'ai',
        }),
      })

      yield takeEvery(hitPredicate, hitHandler)

      yield race<any>([
        take(killedPredicate),
        take('END_GAME'),
        all([
          AIWorkerSaga(playerName),
          put<Action>({
            type: 'ACTIVATE_PLAYER',
            playerName,
            tankId,
          }),
        ]),
      ])
    } finally {
      const tank: TankRecord = yield select(selectors.playerTank, playerName)
      if (tank != null) {
        yield put<Action>({ type: 'REMOVE_TANK', tankId: tank.tankId })
      }
      // 我们在这里不移除 AI 玩家，因为 AI 玩家的子弹可能还处于活跃状态
      if (!(yield cancelled())) {
        addAIReqChannel.put('add')
      }
    }

    /* ----------- below are function definitions ----------- */

    function hitPredicate(action: Action) {
      return action.type === 'HIT' && action.targetPlayer.playerName === playerName
    }

    function* hitHandler(action: Action.Hit) {
      const tank: TankRecord = yield select(selectors.playerTank, playerName)
      DEV.ASSERT && console.assert(tank != null)
      if (tank.hp > 1) {
        yield put<Action>({ type: 'HURT', targetTank: tank })
      } else {
        const { sourcePlayer, sourceTank, targetPlayer, targetTank } = action
        yield put<Action.Kill>({
          type: 'KILL',
          method: 'bullet',
          sourcePlayer,
          sourceTank,
          targetPlayer,
          targetTank,
        })

        yield put({ type: 'REMOVE_TANK', tankId: tank.tankId })
        yield explosionFromTank(tank)
        yield scoreFromKillTank(tank)
      }
    }

    function killedPredicate(action: Action) {
      return (
        action.type === 'KILL' &&
        action.targetTank.side === 'ai' &&
        action.targetPlayer.playerName === playerName
      )
    }
  }
}