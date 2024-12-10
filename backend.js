const express = require("express");
const bcrypt = require("bcrypt");
const db_access = require("./db.js");
const db = db_access.db;
const app = express();
const port = 8888;

app.use(express.json());

/* ==============================
   User Registration and Login
   ============================== */

// User signup
app.post("/user/register", (req, res) => {
  const { name, email, password, isAdmin } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send("Missing required fields: name, email, or password");
  }

  bcrypt.hash(password, 8, (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err.message);
      return res.status(500).send("Internal server error while hashing password");
    }

    const query = `INSERT INTO USER (name, email, password, isAdmin, invitationsLeft) VALUES (?, ?, ?, ?, 10)`;
    db.run(query, [name, email, hashedPassword, isAdmin ? 1 : 0], (err) => {
      if (err) {
        console.error("Database error:", err.message);
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).send("Email already exists");
        }
        return res.status(500).send("Error saving user to database");
      }
      res.status(200).send("Registration successful");
    });
  });
});

// User login
app.post("/user/login", (req, res) => {
  const { email, password } = req.body;

  // Check for missing fields
  if (!email || !password) {
    return res.status(400).send("Email and password are required.");
  }

  const query = `SELECT * FROM USER WHERE email = ?`;
  db.get(query, [email], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error retrieving user data");
    }

    if (!user) {
      return res.status(401).send("Invalid email or password");
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error comparing passwords");
      }

      if (!isMatch) {
        return res.status(401).send("Invalid email or password");
      }

      res.status(200).send({ message: "Login successful", userId: user.id, isAdmin: user.isAdmin });
    });
  });
});

/* ==============================
   Invitation Management
   ============================== */

// Invite a friend
app.post("/user/invite", (req, res) => {
  const { userId, invitedName, invitedAge, invitedEmail, invitedPhone } = req.body;

  // Check for missing fields
  if (!userId || !invitedName || !invitedAge || !invitedEmail || !invitedPhone) {
    return res.status(400).send("All fields (userId, invitedName, invitedAge, invitedEmail, invitedPhone) are required.");
  }

  const checkInvitationsQuery = `SELECT invitationsLeft FROM USER WHERE id = ?`;
  db.get(checkInvitationsQuery, [userId], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error checking user invitations");
    }

    if (!user) return res.status(404).send("User not found");
    if (user.invitationsLeft <= 0) {
      return res.status(400).send("No invitations left");
    }

    const createInvitationQuery = `
      INSERT INTO INVITATIONS (userId, invitedName, invitedAge, invitedEmail, invitedPhone)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.run(
      createInvitationQuery,
      [userId, invitedName, invitedAge, invitedEmail, invitedPhone],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Error creating invitation");
        }

        const updateInvitationsQuery = `
          UPDATE USER SET invitationsLeft = invitationsLeft - 1 WHERE id = ?
        `;
        db.run(updateInvitationsQuery, [userId], (err) => {
          if (err) {
            console.error(err);
            return res.status(500).send("Error updating invitations count");
          }
          res.status(200).send("Invitation sent successfully");
        });
      }
    );
  });
});


app.put("/admin/reset-invitations", (req, res) => {
  const { userId } = req.body;

  // Check if userId is provided in the request body
  if (!userId) {
    return res.status(400).send("userId is required in the request body.");
  }

  const query = `
    UPDATE USER SET invitationsLeft = 10 WHERE id = ?
  `;
  db.run(query, [userId], (err) => {
    if (err) return res.status(500).send("Error resetting invitations");
    res.status(200).send("User invitations reset successfully");
  });
});

/* ==============================
   Class Management (Admin Only)
   ============================== */

// Add a new class
app.post("/admin/class/add", (req, res) => {
  const { name, coachName, dayOfWeek, timeSlot, duration, availableSlots } = req.body;

  // Check for missing fields
  if (!name || !coachName || !dayOfWeek || !timeSlot || !duration) {
    return res.status(400).send("Name, coachName, dayOfWeek, timeSlot, and duration are required.");
  }

  // Default availableSlots to 15 if not provided
  const defaultAvailableSlots = 15;
  const query = `INSERT INTO CLASS (name, coachName, dayOfWeek, timeSlot, duration, availableSlots) VALUES (?, ?, ?, ?, ?, ?)`;

  db.run(query, [name, coachName, dayOfWeek, timeSlot, duration, availableSlots || defaultAvailableSlots], (err) => {
    if (err) return res.status(500).send("Error adding class");
    res.status(200).send("Class added successfully");
  });
});

app.put("/admin/class/edit", (req, res) => {
  const { classId, coachName, timeSlot, dayOfWeek } = req.body; 

  if (!classId) {
    return res.status(400).send("Class ID is required in the request body.");
  }

  const query = `UPDATE CLASS SET coachName = ?, timeSlot = ?, dayOfWeek = ? WHERE id = ?`;

  db.run(query, [coachName, timeSlot, dayOfWeek, classId], (err) => {
    if (err) return res.status(500).send("Error updating class");
    res.status(200).send("Class updated successfully");
  });
});

app.delete("/admin/class/delete", (req, res) => {
  const { classId } = req.body;

  if (!classId) {
    return res.status(400).send("Class ID is required in the request body.");
  }

  const query = `DELETE FROM CLASS WHERE id = ?`;

  db.run(query, [classId], (err) => {
    if (err) return res.status(500).send("Error deleting class");
    res.status(200).send("Class deleted successfully");
  });
});

// Get all classes
app.get("/admin/classes", (req, res) => {
  const query = `SELECT * FROM CLASS`;
  db.all(query, (err, classes) => {
    if (err) return res.status(500).send("Error fetching classes");
    res.status(200).json(classes);
  });
});

app.get("/class/search", (req, res) => {
  const { name } = req.query;
  const query = `SELECT * FROM CLASS WHERE name LIKE ?`;
  db.all(query, [`%${name}%`], (err, classes) => {
    if (err) {
      console.error(err); 
      return res.status(500).send("Error searching classes");
    }
    res.status(200).json(classes);
  });
});

// Book a class
app.post("/class/book", (req, res) => {
  const { userId, classId } = req.body;

  // Check for missing fields
  if (!userId || !classId) {
    return res.status(400).send("userId and classId are required.");
  }

  const checkAvailabilityQuery = `SELECT availableSlots FROM CLASS WHERE id = ?`;
  db.get(checkAvailabilityQuery, [classId], (err, classInfo) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error checking class availability");
    }

    if (!classInfo || classInfo.availableSlots <= 0) {
      return res.status(400).send("Class is fully booked or not found");
    }

    const bookQuery = `INSERT INTO BOOKINGS (userId, classId) VALUES (?, ?)`;
    db.run(bookQuery, [userId, classId], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error booking class");
      }

      const updateSlotsQuery = `UPDATE CLASS SET availableSlots = availableSlots - 1 WHERE id = ?`;
      db.run(updateSlotsQuery, [classId], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Error updating class slots");
        }
        res.status(200).send("Class booked successfully");
      });
    });
  });
});

// Cancel a reservation
app.delete("/class/cancel", (req, res) => {
  const { userId, classId } = req.body;

  // Check for missing fields
  if (!userId || !classId) {
    return res.status(400).send("userId and classId are required.");
  }

  const timeCheckQuery = `SELECT timeSlot FROM CLASS WHERE id = ?`;
  db.get(timeCheckQuery, [classId], (err, classInfo) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error retrieving class information");
    }

    if (!classInfo) {
      return res.status(404).send("Class not found");
    }

    const classTime = new Date(classInfo.timeSlot); 
    const currentTime = new Date();
    const cancellationDeadline = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

    if (classTime - currentTime < cancellationDeadline) {
      return res.status(400).send("Cannot cancel reservation within 3 hours of the class");
    }

    const cancelQuery = `DELETE FROM BOOKINGS WHERE userId = ? AND classId = ?`;
    db.run(cancelQuery, [userId, classId], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error canceling reservation");
      }

      const updateSlotsQuery = `UPDATE CLASS SET availableSlots = availableSlots + 1 WHERE id = ?`;
      db.run(updateSlotsQuery, [classId], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send("Error updating class slots");
        }
        res.status(200).send("Reservation canceled successfully");
      });
    });
  });
});

// View user's booking history
app.get("/user/bookings/:userId", (req, res) => {
  const userId = req.params.userId;
  const query = `SELECT * FROM BOOKINGS WHERE userId = ?`;
  db.all(query, [userId], (err, bookings) => {
    if (err) {
      console.error(err); 
      return res.status(500).send("Error fetching booking history");
    }
    res.status(200).json(bookings);
  });
});

/* ==============================
   Server Initialization
   ============================== */

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  db.serialize(() => {
    db.run(db_access.createUserTable);
    db.run(db_access.createClassTable);
    db.run(db_access.createBookingsTable);
    db.run(db_access.createInvitationsTable);
  });
});
