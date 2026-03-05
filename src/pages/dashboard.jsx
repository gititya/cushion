import { Box, Typography } from '@mui/material'

/**
 * Dashboard -- Phase 1 placeholder.
 * Charts and quick stats will be built in the next session.
 */
export default function Dashboard() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} color="primary">
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" mt={1}>
        Monthly overview coming soon.
      </Typography>
    </Box>
  )
}
