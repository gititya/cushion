import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../contexts/AuthContext.jsx'

const DRAWER_WIDTH = 240

const navItems = [
  { label: 'dashboard', path: '/', icon: <DashboardOutlinedIcon /> },
  { label: 'expenses', path: '/expenses', icon: <ReceiptLongOutlinedIcon /> },
  { label: 'income', path: '/income', icon: <AccountBalanceWalletOutlinedIcon /> },
  { label: 'recurring', path: '/recurring', icon: <AutorenewIcon /> },
  { label: 'assets', path: '/assets', icon: <AccountBalanceOutlinedIcon /> },
  { label: 'emis', path: '/emis', icon: <CreditCardOutlinedIcon /> },
]

const settingsItems = [
  { label: 'categories', path: '/settings/categories', icon: <CategoryOutlinedIcon /> },
  { label: 'cards', path: '/settings/cards', icon: <CreditCardOutlinedIcon /> },
]

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleDrawerToggle() {
    setMobileOpen((v) => !v)
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const drawerContent = (
    <Box className="flex flex-col h-full">
      {/* Brand */}
      <Box className="gradient-hero px-4 py-5">
        <Typography variant="h6" fontWeight={700} sx={{ color: '#fff' }}>
          cushion
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          all things money
        </Typography>
      </Box>

      {/* Nav */}
      <List sx={{ flex: 1, pt: 1 }}>
        {navItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={active}
                onClick={() => {
                  navigate(item.path)
                  setMobileOpen(false)
                }}
                sx={{
                  mx: 1,
                  borderRadius: 3,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.light',
                    color: '#fff',
                    '& .MuiListItemIcon-root': { color: '#fff' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 600 : 400, variant: 'body2' }} />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      <Divider />

      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          settings
        </Typography>
      </Box>

      {/* Settings + logout */}
      <List>
        {settingsItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              onClick={() => {
                navigate(item.path)
                setMobileOpen(false)
              }}
              sx={{ mx: 1, borderRadius: 3 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout} sx={{ mx: 1, borderRadius: 3 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="sign out" primaryTypographyProps={{ variant: 'body2' }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile app bar */}
      <AppBar
        position="fixed"
        sx={{ display: { sm: 'none' }, backgroundColor: '#6750A4' }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={700}>
            cushion
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: { sm: `${DRAWER_WIDTH}px` },
          mt: { xs: '56px', sm: 0 },
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
