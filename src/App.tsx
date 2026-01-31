import { RouterProvider, createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

const rootRoute = createRootRoute({
    component: () => (
        <>
            <div className="p-2 flex gap-2">
                Test Nav
            </div>
            <hr />
            <Outlet />
            <TanStackRouterDevtools />
        </>
    ),
})

import Dashboard from './pages/Dashboard'

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Dashboard,
})

const routeTree = rootRoute.addChildren([indexRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

function App() {
    return <RouterProvider router={router} />
}

export default App
