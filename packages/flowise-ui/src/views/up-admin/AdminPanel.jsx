import React, { useEffect, useState } from 'react'
import { useTranslation } from '@universo/i18n/hooks'
import api from '@/api'
import { Box, Table, TableHead, TableRow, TableCell, TableBody, Button, Checkbox } from '@mui/material'

const AdminPanel = () => {
    const { t } = useTranslation('admin')
    const [users, setUsers] = useState([])

    useEffect(() => {
        // Fetch list of users through API
        api.get('/api/v1/users')
            .then((res) => setUsers(res.data))
            .catch((err) => console.error('Error fetching users:', err))
    }, [])

    const handleToggleSuperAdmin = async (userId, currentValue) => {
        try {
            await api.patch(`/api/v1/users/${userId}`, { is_super_admin: !currentValue })
            setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, is_super_admin: !currentValue } : user)))
        } catch (err) {
            console.error('Error updating user:', err)
        }
    }

    const handleToggleBanned = async (userId, currentValue) => {
        try {
            await api.patch(`/api/v1/users/${userId}`, { is_banned: !currentValue })
            setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, is_banned: !currentValue } : user)))
        } catch (err) {
            console.error('Error updating user:', err)
        }
    }

    const handleDelete = async (userId) => {
        try {
            await api.delete(`/api/v1/users/${userId}`)
            setUsers((prev) => prev.filter((user) => user.id !== userId))
        } catch (err) {
            console.error('Error deleting user:', err)
        }
    }

    return (
        <Box sx={{ padding: 2 }}>
            <h1>{t('title')}</h1>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>{t('email')}</TableCell>
                        <TableCell>{t('superAdmin')}</TableCell>
                        <TableCell>{t('banned')}</TableCell>
                        <TableCell>{t('actions')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {users.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                                <Checkbox
                                    checked={user.is_super_admin}
                                    onChange={() => handleToggleSuperAdmin(user.id, user.is_super_admin)}
                                />
                            </TableCell>
                            <TableCell>
                                <Checkbox checked={user.is_banned} onChange={() => handleToggleBanned(user.id, user.is_banned)} />
                            </TableCell>
                            <TableCell>
                                <Button variant='outlined' color='error' onClick={() => handleDelete(user.id)}>
                                    {t('delete')}
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    )
}

export default AdminPanel
