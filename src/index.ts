import { setOC } from 'replicad'
import { textToSolid } from './solid'
import { toStepBuffer, toStlBuffer } from './exporter'
import { downloadBuffer } from './download'
import { initOCC } from './occLoader'
import type { TextToCADOptions, TextToCADResult } from './types'

let occPromise: Promise<void> | null = null

function ensureOCC(): Promise<void> {
  if (!occPromise) {
    occPromise = initOCC()
      .then((OC) => {
        setOC(OC)
      })
      .catch((err) => {
        occPromise = null // 失敗時は次回呼び出しで再試行できるようにする
        throw err
      })
  }
  return occPromise
}

export async function textToCAD(
  text: string,
  options: TextToCADOptions,
): Promise<TextToCADResult> {
  if (!text) throw new Error('text must not be empty')

  const { font, fontSize = 10, depth = 3, separate = false } = options

  await ensureOCC()

  const solid = await textToSolid(text, font, fontSize, depth, separate)

  const [stepBuffer, stlBuffer] = await Promise.all([
    toStepBuffer(solid),
    toStlBuffer(solid),
  ])

  return {
    step: stepBuffer,
    stl: stlBuffer,
    downloadStep: (filename = 'output.stp') => downloadBuffer(stepBuffer, filename),
    downloadStl: (filename = 'output.stl') => downloadBuffer(stlBuffer, filename),
  }
}

export type { TextToCADOptions, TextToCADResult }
