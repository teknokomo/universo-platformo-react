// Universo Platformo | Publication routes
import { Router } from 'express'
// Use import with alias to avoid conflict with PublishController.ts
import * as projectPublishController from '../controllers/publishController'

const router = Router()

/**
 * @route   POST /publish/projects
 * @desc    Publishes a project
 * @access  Public
 */
router.post('/projects', projectPublishController.publishProject)

/**
 * @route   GET /publish/projects
 * @desc    Gets a list of published projects
 * @access  Public
 */
router.get('/projects', projectPublishController.getPublishedProjects)

/**
 * @route   GET /publish/projects/:id
 * @desc    Gets a published project by ID
 * @access  Public
 */
router.get('/projects/:id', projectPublishController.getPublishedProject)

export default router
