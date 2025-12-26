// ============================================
// 📋 CHATBOT ADMIN CONTROLLER
// ============================================
// Admin CRUD operations for chatbot knowledge management

const pool = require('../config/database');

// Get all chatbot knowledge entries
const getAllKnowledge = async (req, res) => {
  try {
    const [entries] = await pool.query(
      "SELECT * FROM chatbot_knowledge ORDER BY priority DESC, category ASC"
    );

    return res.json(entries);
  } catch (error) {
    console.error('Error fetching chatbot knowledge:', error);
    return res.status(500).json({ error: 'Failed to fetch chatbot knowledge' });
  }
};

// Get single chatbot knowledge entry by ID
const getKnowledgeById = async (req, res) => {
  try {
    const { id } = req.params;

    const [entries] = await pool.query(
      "SELECT * FROM chatbot_knowledge WHERE id = $1",
      [id]
    );

    if (entries.length === 0) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }

    return res.json(entries[0]);
  } catch (error) {
    console.error('Error fetching knowledge entry:', error);
    return res.status(500).json({ error: 'Failed to fetch knowledge entry' });
  }
};

// Create new chatbot knowledge entry
const createKnowledge = async (req, res) => {
  try {
    const { category, keywords, response, suggestions, priority, is_active } = req.body;

    // Validation
    if (!category || !keywords || !response) {
      return res.status(400).json({ 
        error: 'Category, keywords, and response are required' 
      });
    }

    // Check if category already exists
    const [existing] = await pool.query(
      "SELECT id FROM chatbot_knowledge WHERE category = $1",
      [category]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        error: 'Category already exists. Use update instead.' 
      });
    }

    // Insert new entry
    const [result] = await pool.query(
      "INSERT INTO chatbot_knowledge (category, keywords, response, suggestions, priority, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [
        category,
        keywords || '',
        response,
        suggestions || '',
        priority || 0,
        is_active !== undefined ? is_active : true
      ]
    );

    // Fetch the created entry
    const [newEntry] = await pool.query(
      "SELECT * FROM chatbot_knowledge WHERE id = $1",
      [result[0].id]
    );

    return res.status(201).json({
      message: 'Knowledge entry created successfully',
      data: newEntry[0]
    });
  } catch (error) {
    console.error('Error creating knowledge entry:', error);
    return res.status(500).json({ error: 'Failed to create knowledge entry' });
  }
};

// Update chatbot knowledge entry
const updateKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, keywords, response, suggestions, priority, is_active } = req.body;

    // Check if entry exists
    const [existing] = await pool.query(
      "SELECT id FROM chatbot_knowledge WHERE id = $1",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }

    // If category is being changed, check if new category already exists
    if (category) {
      const [categoryCheck] = await pool.query(
        "SELECT id FROM chatbot_knowledge WHERE category = $1 AND id != $2",
        [category, id]
      );

      if (categoryCheck.length > 0) {
        return res.status(400).json({ 
          error: 'Category already exists' 
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category);
    }
    if (keywords !== undefined) {
      updates.push(`keywords = $${paramIndex++}`);
      values.push(keywords);
    }
    if (response !== undefined) {
      updates.push(`response = $${paramIndex++}`);
      values.push(response);
    }
    if (suggestions !== undefined) {
      updates.push(`suggestions = $${paramIndex++}`);
      values.push(suggestions);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const idParam = `$${paramIndex}`;

    await pool.query(
      `UPDATE chatbot_knowledge SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ${idParam}`,
      values
    );

    // Fetch updated entry
    const [updatedEntry] = await pool.query(
      "SELECT * FROM chatbot_knowledge WHERE id = $1",
      [id]
    );

    return res.json({
      message: 'Knowledge entry updated successfully',
      data: updatedEntry[0]
    });
  } catch (error) {
    console.error('Error updating knowledge entry:', error);
    return res.status(500).json({ error: 'Failed to update knowledge entry' });
  }
};

// Delete chatbot knowledge entry
const deleteKnowledge = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if entry exists
    const [existing] = await pool.query(
      "SELECT id FROM chatbot_knowledge WHERE id = $1",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }

    await pool.query(
      "DELETE FROM chatbot_knowledge WHERE id = $1",
      [id]
    );

    return res.json({ message: 'Knowledge entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting knowledge entry:', error);
    return res.status(500).json({ error: 'Failed to delete knowledge entry' });
  }
};

// Toggle knowledge entry active status
const toggleKnowledgeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current status
    const [entries] = await pool.query(
      "SELECT is_active FROM chatbot_knowledge WHERE id = $1",
      [id]
    );

    if (entries.length === 0) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }

    const newStatus = !entries[0].is_active;

    await pool.query(
      "UPDATE chatbot_knowledge SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [newStatus, id]
    );

    return res.json({
      message: `Knowledge entry ${newStatus ? 'activated' : 'deactivated'} successfully`,
      is_active: newStatus
    });
  } catch (error) {
    console.error('Error toggling knowledge status:', error);
    return res.status(500).json({ error: 'Failed to toggle knowledge status' });
  }
};

module.exports = {
  getAllKnowledge,
  getKnowledgeById,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  toggleKnowledgeStatus
};

