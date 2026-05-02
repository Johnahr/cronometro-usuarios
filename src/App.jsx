import { useEffect, useRef, useState } from 'react'
import Sortable from 'sortablejs'
import { supabase } from './lib/supabase'
import './App.css'

function crearCronometroLocal() {
  return {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now() + Math.random()),
    nombre: 'Cronómetro',
    objetivo: 60,
    sonidoUrl: '',
    orden: 0,
    acumuladoMs: 0,
    inicioMs: null,
    corriendo: false,
    alertado: false,
    guardado: false,
  }
}

function convertirCronometro(row) {
  return {
    id: row.id,
    nombre: row.nombre || 'Cronómetro',
    objetivo: Number(row.objetivo_segundos) || 60,
    sonidoUrl: row.sonido_url || '',
    orden: row.orden || 0,
    acumuladoMs: 0,
    inicioMs: null,
    corriendo: false,
    alertado: false,
    guardado: true,
  }
}

function formatearTiempo(ms) {
  const totalSegundos = Math.floor(ms / 1000)
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)
  const segundos = totalSegundos % 60

  if (horas > 0) {
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(
      2,
      '0'
    )}:${String(segundos).padStart(2, '0')}`
  }

  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(
    2,
    '0'
  )}`
}

function obtenerTiempoMs(cronometro, ahora) {
  if (!cronometro) return 0

  if (cronometro.corriendo && cronometro.inicioMs) {
    return cronometro.acumuladoMs + (ahora - cronometro.inicioMs)
  }

  return cronometro.acumuladoMs
}

function obtenerProgreso(cronometro, ms) {
  const objetivo = Number(cronometro?.objetivo) || 0
  if (objetivo <= 0) return 0

  return Math.min(100, (ms / (objetivo * 1000)) * 100)
}

function App() {
  const listaRef = useRef(null)
  const audioRef = useRef(null)

  const [cronometros, setCronometros] = useState([])
  const [sonidos, setSonidos] = useState([])
  const [activoId, setActivoId] = useState(null)
  const [ahora, setAhora] = useState(Date.now())
  const [cargando, setCargando] = useState(true)
  const [sonidoActivo, setSonidoActivo] = useState('')
  const [mostrarSonido, setMostrarSonido] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    const intervalo = setInterval(() => {
      setAhora(Date.now())
    }, 250)

    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    if (!listaRef.current) return

    const sortable = Sortable.create(listaRef.current, {
      animation: 160,
      handle: '.drag-handle',
      onEnd: () => {
        const ids = Array.from(listaRef.current.children).map(
          (el) => el.dataset.id
        )

        setCronometros((actuales) => {
          const ordenados = ids
            .map((id) => actuales.find((cronometro) => cronometro.id === id))
            .filter(Boolean)
            .map((cronometro, index) => ({ ...cronometro, orden: index }))

          guardarOrden(ordenados)

          return ordenados
        })
      },
    })

    return () => sortable.destroy()
  }, [cronometros.length])

  useEffect(() => {
    const cumplido = cronometros.find((cronometro) => {
      const tiempo = obtenerTiempoMs(cronometro, ahora)
      const objetivoMs = Number(cronometro.objetivo || 0) * 1000

      return (
        cronometro.corriendo &&
        objetivoMs > 0 &&
        tiempo >= objetivoMs &&
        !cronometro.alertado
      )
    })

    if (!cumplido) return

    setCronometros((actuales) =>
      actuales.map((cronometro) =>
        cronometro.id === cumplido.id
          ? { ...cronometro, alertado: true }
          : cronometro
      )
    )

    const sonido = sonidos.find((s) => s.url === cumplido.sonidoUrl)
    reproducirSonido(cumplido.sonidoUrl, sonido?.nombre || cumplido.nombre)
  }, [ahora, cronometros, sonidos])

  async function cargarDatos() {
    setCargando(true)

    await Promise.all([cargarCronometros(), cargarSonidos()])

    setCargando(false)
  }

  async function cargarCronometros() {
    const { data, error } = await supabase
      .from('cronometros')
      .select('id, nombre, objetivo_segundos, sonido_url, orden')
      .order('orden', { ascending: true })

    if (error) {
      console.warn('No se pudieron cargar cronómetros:', error.message)

      const local = crearCronometroLocal()
      setCronometros([local])
      setActivoId(local.id)

      return
    }

    const lista = data?.length
      ? data.map(convertirCronometro)
      : [crearCronometroLocal()]

    setCronometros(lista)
    setActivoId(lista[0]?.id || null)
  }

  async function cargarSonidos() {
    const { data, error } = await supabase
      .from('sonidos')
      .select('id, nombre, url, orden')
      .order('orden', { ascending: true })

    if (error) {
      console.warn('No se pudieron cargar sonidos:', error.message)
      setSonidos([])
      return
    }

    setSonidos(data || [])
  }

  async function agregarCronometro() {
    const nuevo = {
      nombre: 'Cronómetro',
      objetivo_segundos: 60,
      sonido_url: '',
      orden: cronometros.length,
    }

    const { data, error } = await supabase
      .from('cronometros')
      .insert(nuevo)
      .select('id, nombre, objetivo_segundos, sonido_url, orden')
      .single()

    if (error) {
      console.warn('No se pudo guardar el cronómetro:', error.message)

      const local = {
        ...crearCronometroLocal(),
        orden: cronometros.length,
      }

      setCronometros((actuales) => [...actuales, local])
      setActivoId(local.id)

      return
    }

    const convertido = convertirCronometro(data)

    setCronometros((actuales) => [...actuales, convertido])
    setActivoId(convertido.id)
  }

  async function actualizarCronometro(id, campo, valor) {
    const valorFinal =
      campo === 'objetivo' ? Math.max(0, parseInt(valor, 10) || 0) : valor

    setCronometros((actuales) =>
      actuales.map((cronometro) =>
        cronometro.id === id
          ? {
              ...cronometro,
              [campo]: valorFinal,
              alertado: campo === 'objetivo' ? false : cronometro.alertado,
            }
          : cronometro
      )
    )

    const campos = {
      nombre: 'nombre',
      objetivo: 'objetivo_segundos',
      sonidoUrl: 'sonido_url',
    }

    const campoDB = campos[campo]
    if (!campoDB) return

    const cronometro = cronometros.find((c) => c.id === id)
    if (!cronometro?.guardado) return

    const { error } = await supabase
      .from('cronometros')
      .update({ [campoDB]: valorFinal })
      .eq('id', id)

    if (error) {
      console.warn('No se pudo actualizar:', error.message)
    }
  }

  async function eliminarCronometro(id) {
    const cronometro = cronometros.find((c) => c.id === id)
    const restantes = cronometros.filter((item) => item.id !== id)

    if (restantes.length === 0) {
      const local = crearCronometroLocal()
      setCronometros([local])
      setActivoId(local.id)
    } else {
      setCronometros(restantes)

      if (activoId === id) {
        setActivoId(restantes[0]?.id || null)
      }
    }

    if (!cronometro?.guardado) return

    const { error } = await supabase.from('cronometros').delete().eq('id', id)

    if (error) {
      console.warn('No se pudo eliminar:', error.message)
    }
  }

  async function guardarOrden(lista) {
    const guardados = lista.filter((cronometro) => cronometro.guardado)

    await Promise.all(
      guardados.map((cronometro, index) =>
        supabase
          .from('cronometros')
          .update({ orden: index })
          .eq('id', cronometro.id)
      )
    )
  }

  function reproducirSonido(url, nombre) {
    if (!url || !audioRef.current) return

    try {
      audioRef.current.src = url
      audioRef.current.currentTime = 0

      audioRef.current.play().catch((error) => {
        console.warn('Audio bloqueado por el navegador:', error)
      })

      setSonidoActivo(nombre || 'Sonido')
      setMostrarSonido(true)

      setTimeout(() => {
        setMostrarSonido(false)
      }, 3000)
    } catch (error) {
      console.warn('Error reproduciendo audio:', error)
    }
  }

  function iniciar(id) {
    const base = Date.now()
    const cronometro = cronometros.find((item) => item.id === id)
    const sonido = sonidos.find((s) => s.url === cronometro?.sonidoUrl)

    setCronometros((actuales) =>
      actuales.map((item) =>
        item.id === id && !item.corriendo
          ? { ...item, corriendo: true, inicioMs: base }
          : item
      )
    )

    setActivoId(id)
    reproducirSonido(cronometro?.sonidoUrl, sonido?.nombre)
  }

  function pausar(id) {
    const base = Date.now()

    setCronometros((actuales) =>
      actuales.map((item) => {
        if (item.id !== id || !item.corriendo) return item

        return {
          ...item,
          corriendo: false,
          acumuladoMs: item.acumuladoMs + (base - item.inicioMs),
          inicioMs: null,
        }
      })
    )
  }

  function reiniciar(id) {
    setCronometros((actuales) =>
      actuales.map((item) =>
        item.id === id
          ? {
              ...item,
              acumuladoMs: 0,
              inicioMs: item.corriendo ? Date.now() : null,
              alertado: false,
            }
          : item
      )
    )

    setActivoId(id)
  }

  function pausarTodos() {
    const base = Date.now()

    setCronometros((actuales) =>
      actuales.map((item) => {
        if (!item.corriendo) return item

        return {
          ...item,
          corriendo: false,
          acumuladoMs: item.acumuladoMs + (base - item.inicioMs),
          inicioMs: null,
        }
      })
    )
  }

  function reiniciarTodos() {
    setCronometros((actuales) =>
      actuales.map((item) => ({
        ...item,
        acumuladoMs: 0,
        inicioMs: item.corriendo ? Date.now() : null,
        alertado: false,
      }))
    )
  }

  return (
    <>
      <main className="app-shell">
        <section className="container">
          <header className="header">
            <p className="eyebrow">
              <span className="dot"></span> App Alex fit
            </p>
            <h1>Cronómetros de entrenamiento</h1>
          </header>

          <div className="toolbar">
            <button className="btn-add" onClick={agregarCronometro}>
              + Agregar cronómetro
            </button>

            <button className="btn-soft" onClick={pausarTodos}>
              Pausar todos
            </button>

            <button className="btn-soft" onClick={reiniciarTodos}>
              Reiniciar todos
            </button>
          </div>

          {cargando ? (
            <div className="loading">Cargando cronómetros...</div>
          ) : (
            <div id="lista-tareas" ref={listaRef}>
              {cronometros.map((cronometro) => {
                const tiempo = obtenerTiempoMs(cronometro, ahora)
                const progreso = obtenerProgreso(cronometro, tiempo)

                return (
                  <article
                    className={`fila ${
                      activoId === cronometro.id ? 'current-task' : ''
                    }`}
                    key={cronometro.id}
                    data-id={cronometro.id}
                    onClick={() => setActivoId(cronometro.id)}
                  >
                    <span className="drag-handle">⠿</span>

                    <input
                      className="input-nombre"
                      value={cronometro.nombre}
                      onChange={(e) =>
                        actualizarCronometro(
                          cronometro.id,
                          'nombre',
                          e.target.value
                        )
                      }
                    />

                    <input
                      className="input-tiempo"
                      type="number"
                      min="0"
                      value={cronometro.objetivo}
                      title="Meta en segundos"
                      onChange={(e) =>
                        actualizarCronometro(
                          cronometro.id,
                          'objetivo',
                          e.target.value
                        )
                      }
                    />

                    <select
                      className="input-sonido"
                      value={cronometro.sonidoUrl}
                      onChange={(e) =>
                        actualizarCronometro(
                          cronometro.id,
                          'sonidoUrl',
                          e.target.value
                        )
                      }
                    >
                      <option value="">🔇 Sin sonido</option>

                      {sonidos.map((sonido) => (
                        <option key={sonido.id} value={sonido.url}>
                          {sonido.nombre}
                        </option>
                      ))}
                    </select>

                    <strong className="mini-tiempo">
                      {formatearTiempo(tiempo)}
                    </strong>

                    <button
                      className={`btn-mini ${
                        cronometro.corriendo ? 'pause' : 'play'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        cronometro.corriendo
                          ? pausar(cronometro.id)
                          : iniciar(cronometro.id)
                      }}
                    >
                      {cronometro.corriendo ? 'Pausar' : 'Iniciar'}
                    </button>

                    <button
                      className="btn-reset"
                      onClick={(e) => {
                        e.stopPropagation()
                        reiniciar(cronometro.id)
                      }}
                    >
                      ↺
                    </button>

                    <button
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        eliminarCronometro(cronometro.id)
                      }}
                    >
                      ✕
                    </button>

                    <div className="mini-progress">
                      <span style={{ width: `${progreso}%` }} />
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <div className={`sound-playing ${mostrarSonido ? 'visible' : ''}`}>
        🔊 <span>{sonidoActivo}</span>
      </div>

      <audio ref={audioRef} preload="auto" />
    </>
  )
}

export default App