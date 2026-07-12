import { useState, useLayoutEffect } from "react"

export function useViewport(mainRef, cellW, cellH) {
    const [viewport, setViewport] = useState({
        scrollLeft: 0,
        scrollTop: 0,
        width: 0,
        height: 0,
    })

    useLayoutEffect(() => {
        const el = mainRef.current
        if (!el) return

        let frame = null

        function update() {
            frame = null

            setViewport({
                scrollLeft: el.scrollLeft,
                scrollTop: el.scrollTop,
                width: el.clientWidth,
                height: el.clientHeight,
            })
        }

        function scheduleUpdate() {
            if (frame !== null) return

            frame = requestAnimationFrame(update)
        }

        update()

        el.addEventListener("scroll", scheduleUpdate, {
            passive: true,
        })

        window.addEventListener("resize", scheduleUpdate)

        return () => {
            el.removeEventListener("scroll", scheduleUpdate)
            window.removeEventListener("resize", scheduleUpdate)

            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
        }
    }, [mainRef])

    const columnOverscan = 16
    const rowOverscan = 4

    const firstCol =
        Math.floor(viewport.scrollLeft / cellW)
        - columnOverscan

    const lastCol =
        Math.ceil(
            (viewport.scrollLeft + viewport.width) / cellW
        )
        + columnOverscan

    const firstRow =
        Math.floor(viewport.scrollTop / cellH)
        - rowOverscan

    const lastRow =
        Math.ceil(
            (viewport.scrollTop + viewport.height) / cellH
        )
        + rowOverscan

    return {
        ...viewport,

        firstCol,
        lastCol,

        firstRow,
        lastRow,
    }
}