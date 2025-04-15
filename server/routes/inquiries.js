const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticateToken = require('../middleware/auth');

// Helper function to ensure consistent date formatting
const getFormattedDate = () => {
  // Create a date with Philippines timezone offset (+8 hours)
  const now = new Date();
  // Adjust for PHP timezone (UTC+8)
  now.setTime(now.getTime() + (8 * 60 * 60 * 1000));
  return now.toISOString();
};

// Create necessary tables if they don't exist
const createTablesIfNeeded = () => {
  try {
    // Create inquiries table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        user_id INTEGER,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id)
      )
    `).run();
    console.log('Ensured inquiries table exists');
    
    // Create inquiry_messages table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS inquiry_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inquiry_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_from_agent BOOLEAN NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TEXT NOT NULL,
        FOREIGN KEY (inquiry_id) REFERENCES inquiries (id)
      )
    `).run();
    console.log('Ensured inquiry_messages table exists');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
};

// Initialize tables when the server starts
createTablesIfNeeded();

// Get inquiries for an agent
router.get('/agent', authenticateToken, (req, res) => {
  try {
    console.log('GET /inquiries/agent received from user ID:', req.user.userId);
    
    // Check if user is an agent
    const userStmt = db.prepare('SELECT role FROM users WHERE id = ?');
    const user = userStmt.get(req.user.userId);
    console.log('User role:', user?.role);
    
    if (!user || user.role !== 'agent') {
      return res.status(403).json({ error: 'Only agents can access this endpoint' });
    }
    
    // Get agent ID
    const agentStmt = db.prepare('SELECT id FROM agents WHERE users_id = ?');
    const agent = agentStmt.get(req.user.userId);
    console.log('Agent info:', agent);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    
    try {
      // Get properties for this agent
      const propertiesStmt = db.prepare('SELECT id FROM properties WHERE agents_id = ?');
      const properties = propertiesStmt.all(agent.id);
      console.log('Properties count:', properties.length);
      
      if (properties.length === 0) {
        return res.json([]);
      }
      
      // Extract property IDs
      const propertyIds = properties.map(prop => prop.id);
      console.log('Property IDs:', propertyIds);
      
      // Build IN clause for SQL
      const placeholders = propertyIds.map(() => '?').join(',');
      
      // Get inquiries for these properties
      try {
        const inquiriesStmt = db.prepare(`
          SELECT 
            i.id, 
            i.property_id, 
            i.user_id AS sender_id, 
            i.name AS sender_name, 
            i.email AS sender_email,
            i.phone AS sender_phone,
            i.message AS initial_message,
            i.created_at,
            p.title AS property_title,
            p.image_url AS property_image_url,
            a.id AS agent_id,
            a.name AS agent_name
          FROM inquiries i
          JOIN properties p ON i.property_id = p.id
          JOIN agents a ON p.agents_id = a.id
          WHERE i.property_id IN (${placeholders})
          ORDER BY i.created_at DESC
        `);
        
        const inquiries = inquiriesStmt.all(...propertyIds);
        console.log('Inquiries found:', inquiries.length);
        
        // Process each inquiry to get the latest message and unread count
        const result = [];
        for (const inquiry of inquiries) {
          try {
            // Get the most recent message
            const lastMessageStmt = db.prepare(`
              SELECT message, created_at 
              FROM inquiry_messages 
              WHERE inquiry_id = ? 
              ORDER BY created_at DESC 
              LIMIT 1
            `);
            
            const lastMessage = lastMessageStmt.get(inquiry.id);
            
            // Count unread messages from the buyer
            const unreadCountStmt = db.prepare(`
              SELECT COUNT(*) as count 
              FROM inquiry_messages 
              WHERE inquiry_id = ? AND is_from_agent = FALSE AND is_read = FALSE
            `);
            
            const unreadCount = unreadCountStmt.get(inquiry.id);
            
            result.push({
              ...inquiry,
              last_message: lastMessage?.message || inquiry.initial_message || 'No message',
              last_message_time: lastMessage?.created_at || inquiry.created_at,
              unread_count: unreadCount?.count || 0
            });
          } catch (messageError) {
            console.error('Error processing inquiry messages for inquiry ID:', inquiry.id, messageError);
            // Still add the inquiry with default values
            result.push({
              ...inquiry,
              last_message: inquiry.initial_message || 'No message',
              last_message_time: inquiry.created_at,
              unread_count: 0,
              error: 'Error processing messages'
            });
          }
        }
        
        res.json(result);
      } catch (inquiriesError) {
        console.error('Database error fetching inquiries:', inquiriesError);
        
        // Try a simpler query without JOINs as fallback
        try {
          console.log('Trying simpler query as fallback...');
          const simpleInquiriesStmt = db.prepare(`
            SELECT i.* FROM inquiries i
            WHERE i.property_id IN (${placeholders})
            ORDER BY i.created_at DESC
          `);
          
          const simpleInquiries = simpleInquiriesStmt.all(...propertyIds);
          console.log('Simple inquiries found:', simpleInquiries.length);
          
          // Process these inquiries with minimal data
          const simpleResult = simpleInquiries.map(inquiry => {
            // Get property details separately
            let propertyTitle = 'Unknown Property';
            let propertyImage = null;
            
            try {
              const propStmt = db.prepare('SELECT title, image_url FROM properties WHERE id = ?');
              const property = propStmt.get(inquiry.property_id);
              if (property) {
                propertyTitle = property.title;
                propertyImage = property.image_url;
              }
            } catch (e) {
              console.error('Error getting property details:', e);
            }
            
            return {
              ...inquiry,
              property_title: propertyTitle,
              property_image_url: propertyImage,
              agent_id: agent.id,
              agent_name: user.name,
              last_message: inquiry.message || 'No message',
              last_message_time: inquiry.created_at,
              unread_count: 0
            };
          });
          
          res.json(simpleResult);
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return res.status(500).json({ 
            error: 'Database error fetching inquiries',
            details: inquiriesError.message,
            fallback_error: fallbackError.message
          });
        }
      }
    } catch (propertiesError) {
      console.error('Error fetching agent properties:', propertiesError);
      return res.status(500).json({ 
        error: 'Error fetching agent properties',
        details: propertiesError.message
      });
    }
  } catch (error) {
    console.error('Error in /inquiries/agent route:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries', details: error.message });
  }
});

// Get inquiries for a buyer (user)
router.get('/buyer', authenticateToken, (req, res) => {
  try {
    console.log('GET /inquiries/buyer received from user ID:', req.user.userId);
    
    try {
      // Get inquiries where the user is the sender
      const inquiriesStmt = db.prepare(`
        SELECT 
          i.id, 
          i.property_id, 
          i.user_id AS sender_id, 
          i.name AS sender_name, 
          i.email AS sender_email,
          i.phone AS sender_phone,
          i.message AS initial_message,
          i.created_at,
          p.title AS property_title,
          p.image_url AS property_image_url,
          a.id AS agent_id,
          a.name AS agent_name
        FROM inquiries i
        JOIN properties p ON i.property_id = p.id
        JOIN agents a ON p.agents_id = a.id
        WHERE i.user_id = ?
        ORDER BY i.created_at DESC
      `);
      
      const inquiries = inquiriesStmt.all(req.user.userId);
      console.log('Buyer inquiries found:', inquiries.length);
      
      // Process each inquiry to get the latest message and unread count
      const result = [];
      for (const inquiry of inquiries) {
        try {
          // Get the most recent message
          const lastMessageStmt = db.prepare(`
            SELECT message, created_at 
            FROM inquiry_messages 
            WHERE inquiry_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
          `);
          
          const lastMessage = lastMessageStmt.get(inquiry.id);
          
          // Count unread messages from the agent
          const unreadCountStmt = db.prepare(`
            SELECT COUNT(*) as count 
            FROM inquiry_messages 
            WHERE inquiry_id = ? AND is_from_agent = TRUE AND is_read = FALSE
          `);
          
          const unreadCount = unreadCountStmt.get(inquiry.id);
          
          result.push({
            ...inquiry,
            last_message: lastMessage?.message || inquiry.initial_message || 'No message',
            last_message_time: lastMessage?.created_at || inquiry.created_at,
            unread_count: unreadCount?.count || 0
          });
        } catch (messageError) {
          console.error('Error processing inquiry messages for inquiry ID:', inquiry.id, messageError);
          // Still add the inquiry with default values
          result.push({
            ...inquiry,
            last_message: inquiry.initial_message || 'No message',
            last_message_time: inquiry.created_at,
            unread_count: 0,
            error: 'Error processing messages'
          });
        }
      }
      
      res.json(result);
    } catch (inquiriesError) {
      console.error('Database error fetching buyer inquiries:', inquiriesError);
      
      // Try a simpler query without JOINs as fallback
      try {
        console.log('Trying simpler query as fallback for buyer...');
        const simpleInquiriesStmt = db.prepare(`
          SELECT * FROM inquiries 
          WHERE user_id = ?
          ORDER BY created_at DESC
        `);
        
        const simpleInquiries = simpleInquiriesStmt.all(req.user.userId);
        console.log('Simple buyer inquiries found:', simpleInquiries.length);
        
        // Process these inquiries with minimal data
        const simpleResult = simpleInquiries.map(inquiry => {
          // Get property and agent details separately
          let propertyTitle = 'Unknown Property';
          let propertyImage = null;
          let agentId = null;
          let agentName = 'Unknown Agent';
          
          try {
            const propStmt = db.prepare(`
              SELECT p.title, p.image_url, p.agents_id, a.name AS agent_name
              FROM properties p
              JOIN agents a ON p.agents_id = a.id
              WHERE p.id = ?
            `);
            
            const property = propStmt.get(inquiry.property_id);
            if (property) {
              propertyTitle = property.title;
              propertyImage = property.image_url;
              agentId = property.agents_id;
              agentName = property.agent_name;
            }
          } catch (e) {
            console.error('Error getting property details:', e);
          }
          
          return {
            ...inquiry,
            property_title: propertyTitle,
            property_image_url: propertyImage,
            agent_id: agentId,
            agent_name: agentName,
            last_message: inquiry.message || 'No message',
            last_message_time: inquiry.created_at,
            unread_count: 0
          };
        });
        
        res.json(simpleResult);
      } catch (fallbackError) {
        console.error('Fallback query also failed for buyer:', fallbackError);
        return res.status(500).json({ 
          error: 'Database error fetching inquiries',
          details: inquiriesError.message,
          fallback_error: fallbackError.message
        });
      }
    }
  } catch (error) {
    console.error('Error in /inquiries/buyer route:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries', details: error.message });
  }
});

// Get messages for a specific inquiry
router.get('/:id/messages', authenticateToken, (req, res) => {
  try {
    const inquiryId = req.params.id;
    console.log(`Fetching messages for inquiry ID: ${inquiryId}, User ID: ${req.user.userId}`);
    
    // First check if the inquiry exists and the user has access to it
    const inquiryAccessStmt = db.prepare(`
      SELECT 
        i.id, 
        i.property_id, 
        i.user_id AS buyer_id,
        p.agents_id,
        a.users_id AS agent_user_id
      FROM inquiries i
      JOIN properties p ON i.property_id = p.id
      JOIN agents a ON p.agents_id = a.id
      WHERE i.id = ?
    `);
    
    const inquiry = inquiryAccessStmt.get(inquiryId);
    console.log('Inquiry access check:', inquiry);
    
    if (!inquiry) {
      console.log(`Inquiry not found: ${inquiryId}`);
      return res.status(404).json({ error: 'Inquiry not found' });
    }
    
    // Check if the user is either the buyer or the agent for this inquiry
    if (req.user.userId !== inquiry.buyer_id && req.user.userId !== inquiry.agent_user_id) {
      console.log(`Unauthorized access: User ${req.user.userId} is neither buyer (${inquiry.buyer_id}) nor agent (${inquiry.agent_user_id})`);
      return res.status(403).json({ error: 'You do not have permission to access this inquiry' });
    }
    
    try {
      // Get all messages for this inquiry
      const messagesStmt = db.prepare(`
        SELECT 
          im.id,
          im.inquiry_id,
          im.sender_id,
          u.name AS sender_name,
          im.message,
          im.is_from_agent,
          im.is_read,
          im.created_at
        FROM inquiry_messages im
        LEFT JOIN users u ON im.sender_id = u.id
        WHERE im.inquiry_id = ?
        ORDER BY im.created_at ASC
      `);
      
      const messages = messagesStmt.all(inquiryId);
      console.log(`Found ${messages.length} messages for inquiry ${inquiryId}`);
      
      // Ensure all messages have a sender_name, using a fallback if needed
      const processedMessages = messages.map(msg => {
        if (!msg.sender_name) {
          // Try to get the sender name from users table
          try {
            const userStmt = db.prepare('SELECT name FROM users WHERE id = ?');
            const user = userStmt.get(msg.sender_id);
            if (user && user.name) {
              msg.sender_name = user.name;
            } else {
              msg.sender_name = msg.is_from_agent ? 'Agent' : 'Buyer';
            }
          } catch (e) {
            console.error('Error getting sender name:', e);
            msg.sender_name = msg.is_from_agent ? 'Agent' : 'Buyer';
          }
        }
        return msg;
      });
      
      // Also include the initial inquiry message
      const initialInquiryStmt = db.prepare(`
        SELECT 
          i.id,
          i.property_id,
          i.user_id AS sender_id,
          i.name AS sender_name,
          i.message,
          FALSE AS is_from_agent,
          TRUE AS is_read,
          i.created_at
        FROM inquiries i
        WHERE i.id = ?
      `);
      
      const initialInquiry = initialInquiryStmt.get(inquiryId);
      
      if (!initialInquiry) {
        console.log(`Initial inquiry not found for ID: ${inquiryId}`);
        return res.status(404).json({ error: 'Initial inquiry details not found' });
      }
      
      // Ensure initial inquiry has a sender name
      if (!initialInquiry.sender_name) {
        try {
          const userStmt = db.prepare('SELECT name FROM users WHERE id = ?');
          const user = userStmt.get(initialInquiry.sender_id);
          if (user && user.name) {
            initialInquiry.sender_name = user.name;
          } else {
            initialInquiry.sender_name = 'Buyer';
          }
        } catch (e) {
          console.error('Error getting initial inquiry sender name:', e);
          initialInquiry.sender_name = 'Buyer';
        }
      }
      
      // Combine initial inquiry with messages
      const allMessages = [
        {
          id: `initial-${initialInquiry.id}`,
          inquiry_id: initialInquiry.id,
          sender_id: initialInquiry.sender_id,
          sender_name: initialInquiry.sender_name || 'Buyer',
          message: initialInquiry.message,
          is_from_agent: false,
          is_read: true,
          created_at: initialInquiry.created_at
        },
        ...processedMessages
      ];
      
      res.json(allMessages);
    } catch (innerError) {
      console.error('Database error when fetching messages:', innerError);
      
      // If there's a database error, let's try a simplified approach without joining to users
      try {
        console.log('Trying alternative query without JOIN...');
        const simpleMessagesStmt = db.prepare(`
          SELECT 
            id,
            inquiry_id,
            sender_id,
            message,
            is_from_agent,
            is_read,
            created_at
          FROM inquiry_messages
          WHERE inquiry_id = ?
          ORDER BY created_at ASC
        `);
        
        const simpleMessages = simpleMessagesStmt.all(inquiryId);
        console.log(`Found ${simpleMessages.length} messages with simple query`);
        
        // Get initial inquiry
        const initialInquiry = db.prepare(`
          SELECT id, user_id AS sender_id, name AS sender_name, message, created_at
          FROM inquiries WHERE id = ?
        `).get(inquiryId);
        
        // Process simple messages to add sender names
        const userNames = {};
        const getUserName = (userId) => {
          if (!userNames[userId]) {
            try {
              const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
              userNames[userId] = user ? user.name : (userId ? 'User #' + userId : 'Unknown User');
            } catch (e) {
              console.error('Error getting user name:', e);
              userNames[userId] = userId ? 'User #' + userId : 'Unknown User';
            }
          }
          return userNames[userId];
        };
        
        // Format simple messages
        const formattedMessages = simpleMessages.map(msg => ({
          id: msg.id,
          inquiry_id: msg.inquiry_id,
          sender_id: msg.sender_id,
          sender_name: getUserName(msg.sender_id),
          message: msg.message,
          is_from_agent: msg.is_from_agent === 1 || msg.is_from_agent === true,
          is_read: msg.is_read === 1 || msg.is_read === true,
          created_at: msg.created_at
        }));
        
        // Add initial inquiry as first message
        const result = [
          {
            id: `initial-${initialInquiry.id}`,
            inquiry_id: initialInquiry.id,
            sender_id: initialInquiry.sender_id,
            sender_name: initialInquiry.sender_name || getUserName(initialInquiry.sender_id),
            message: initialInquiry.message,
            is_from_agent: false,
            is_read: true,
            created_at: initialInquiry.created_at
          },
          ...formattedMessages
        ];
        
        res.json(result);
      } catch (fallbackError) {
        console.error('Error in fallback query:', fallbackError);
        res.status(500).json({ 
          error: 'Database error fetching messages', 
          details: innerError.message,
          fallbackError: fallbackError.message
        });
      }
    }
  } catch (error) {
    console.error('Error fetching inquiry messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
});

// Send a message in an inquiry
router.post('/:id/messages', authenticateToken, (req, res) => {
  try {
    const inquiryId = req.params.id;
    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`Sending message for inquiry ID: ${inquiryId}, User ID: ${req.user.userId}`);
    
    // First check if the inquiry exists and the user has access to it
    const inquiryAccessStmt = db.prepare(`
      SELECT 
        i.id, 
        i.property_id, 
        i.user_id AS buyer_id,
        p.agents_id,
        a.users_id AS agent_user_id
      FROM inquiries i
      JOIN properties p ON i.property_id = p.id
      JOIN agents a ON p.agents_id = a.id
      WHERE i.id = ?
    `);
    
    const inquiry = inquiryAccessStmt.get(inquiryId);
    console.log('Inquiry access check for sending message:', inquiry);
    
    if (!inquiry) {
      console.log(`Inquiry not found: ${inquiryId}`);
      return res.status(404).json({ error: 'Inquiry not found' });
    }
    
    // Check if the user is either the buyer or the agent for this inquiry
    if (req.user.userId !== inquiry.buyer_id && req.user.userId !== inquiry.agent_user_id) {
      console.log(`Unauthorized access: User ${req.user.userId} is neither buyer (${inquiry.buyer_id}) nor agent (${inquiry.agent_user_id})`);
      return res.status(403).json({ error: 'You do not have permission to send messages to this inquiry' });
    }
    
    // Determine if the message is from the agent or the buyer
    const isFromAgent = req.user.userId === inquiry.agent_user_id;
    
    // Get user details
    const userStmt = db.prepare(`SELECT name FROM users WHERE id = ?`);
    const user = userStmt.get(req.user.userId);
    
    if (!user) {
      console.log(`User not found: ${req.user.userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Make sure we have a valid name for the sender
    const senderName = user.name || (isFromAgent ? 'Agent' : 'Buyer');
    console.log(`Sender name: ${senderName}`);
    
    // Insert the message
    const now = getFormattedDate();
    
    try {
      const insertStmt = db.prepare(`
        INSERT INTO inquiry_messages (
          inquiry_id,
          sender_id,
          message,
          is_from_agent,
          is_read,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = insertStmt.run(
        inquiryId,
        req.user.userId,
        message,
        isFromAgent,
        false,
        now
      );
      
      // Create a notification for the recipient
      const recipientId = isFromAgent ? inquiry.buyer_id : inquiry.agent_user_id;
      
      // Get property details
      const propertyStmt = db.prepare(`SELECT title FROM properties WHERE id = ?`);
      const property = propertyStmt.get(inquiry.property_id);
      
      const notificationMessage = `New message for property "${property.title}" from ${senderName}`;
      
      try {
        const notificationStmt = db.prepare(`
          INSERT INTO notifications (
            user_id,
            type,
            message,
            related_id,
            is_read,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        notificationStmt.run(
          recipientId,
          'property_inquiry',
          notificationMessage,
          inquiryId,
          false,
          now
        );
      } catch (notificationError) {
        // Log but don't fail if notification creation fails
        console.error('Error creating notification:', notificationError);
      }
      
      // Return the created message
      res.status(201).json({
        id: result.lastInsertRowid,
        inquiry_id: inquiryId,
        sender_id: req.user.userId,
        sender_name: senderName,
        message,
        is_from_agent: isFromAgent,
        is_read: false,
        created_at: now
      });
    } catch (dbError) {
      console.error('Database error sending message:', dbError);
      
      // Try alternate approach with explicit boolean values
      try {
        console.log('Trying alternative approach for message insertion...');
        const alternateInsertStmt = db.prepare(`
          INSERT INTO inquiry_messages (
            inquiry_id,
            sender_id,
            message,
            is_from_agent,
            is_read,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const result = alternateInsertStmt.run(
          inquiryId,
          req.user.userId,
          message,
          isFromAgent ? 1 : 0,  // Use integer instead of boolean
          0,                    // Use integer instead of boolean
          now
        );
        
        // Return the created message
        res.status(201).json({
          id: result.lastInsertRowid,
          inquiry_id: inquiryId,
          sender_id: req.user.userId,
          sender_name: senderName,
          message,
          is_from_agent: isFromAgent,
          is_read: false,
          created_at: now
        });
      } catch (alternateError) {
        console.error('Alternative approach also failed:', alternateError);
        res.status(500).json({ 
          error: 'Failed to send message', 
          details: dbError.message,
          alternateError: alternateError.message
        });
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});

// Mark messages as read for a specific inquiry
router.post('/:id/mark-read', authenticateToken, (req, res) => {
  try {
    const inquiryId = req.params.id;
    console.log(`Marking messages as read for inquiry ID: ${inquiryId}, User ID: ${req.user.userId}`);
    
    // First check if the inquiry exists and the user has access to it
    const inquiryAccessStmt = db.prepare(`
      SELECT 
        i.id, 
        i.property_id, 
        i.user_id AS buyer_id,
        p.agents_id,
        a.users_id AS agent_user_id
      FROM inquiries i
      JOIN properties p ON i.property_id = p.id
      JOIN agents a ON p.agents_id = a.id
      WHERE i.id = ?
    `);
    
    const inquiry = inquiryAccessStmt.get(inquiryId);
    console.log('Inquiry access check for marking as read:', inquiry);
    
    if (!inquiry) {
      console.log(`Inquiry not found when marking as read: ${inquiryId}`);
      return res.status(404).json({ error: 'Inquiry not found' });
    }
    
    // Check if the user is either the buyer or the agent for this inquiry
    if (req.user.userId !== inquiry.buyer_id && req.user.userId !== inquiry.agent_user_id) {
      console.log(`Unauthorized access when marking as read: User ${req.user.userId} is neither buyer (${inquiry.buyer_id}) nor agent (${inquiry.agent_user_id})`);
      return res.status(403).json({ error: 'You do not have permission to access this inquiry' });
    }
    
    // Mark messages as read based on who's reading them
    const isAgent = req.user.userId === inquiry.agent_user_id;
    console.log(`User is ${isAgent ? 'agent' : 'buyer'}, marking ${!isAgent ? 'agent' : 'buyer'} messages as read`);
    
    try {
      const updateStmt = db.prepare(`
        UPDATE inquiry_messages
        SET is_read = TRUE
        WHERE inquiry_id = ? AND is_from_agent = ? AND is_read = FALSE
      `);
      
      // If the agent is reading, mark buyer messages as read
      // If the buyer is reading, mark agent messages as read
      const result = updateStmt.run(inquiryId, !isAgent);
      console.log(`Marked ${result.changes} messages as read`);
      
      res.json({ message: 'Messages marked as read', count: result.changes });
    } catch (dbError) {
      console.error('Database error when marking messages as read:', dbError);
      // Try a simpler approach if the initial approach failed
      try {
        console.log('Trying alternative mark-read query...');
        const simpleUpdateStmt = db.prepare(`
          UPDATE inquiry_messages
          SET is_read = 1
          WHERE inquiry_id = ? AND is_from_agent = ? AND is_read = 0
        `);
        
        const result = simpleUpdateStmt.run(inquiryId, !isAgent ? 1 : 0);
        console.log(`Simple approach: Marked ${result.changes} messages as read`);
        
        res.json({ message: 'Messages marked as read', count: result.changes });
      } catch (fallbackError) {
        console.error('Error in fallback mark-read query:', fallbackError);
        res.status(500).json({ 
          error: 'Database error marking messages as read', 
          details: dbError.message, 
          fallbackError: fallbackError.message 
        });
      }
    }
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read', details: error.message });
  }
});

module.exports = router; 