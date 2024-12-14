const express = require("express");
const bcrypt = require("bcrypt");
const db_access = require("./db.js");
const db = db_access.db;
const app = express();
const port = 8888;
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:3000',  
}));
app.use(express.json());

app.post("/user/register", (req, res) => {
  const { name, email, password, isAdmin } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  bcrypt.hash(password, 8, (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err.message);
      return res.status(500).json({ error: 'Password hashing error.' });
    }

    const query = `INSERT INTO USER (name, email, password, isAdmin, invitationsLeft) VALUES (?, ?, ?, ?, 10)`;
    db.run(query, [name, email, hashedPassword, isAdmin ? 1 : 0], (err) => {
      if (err) {
        console.error("Database error:", err.message);
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({ error: 'Email already exists.' });
        }
        return res.status(500).json({ error: 'Error saving user to Database.' });
      }
      return res.status(200).json({ message: 'Registration successful!' });
    });
  });
});

app.post("/user/login", (req, res) => {
  const { email, password } = req.body;

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

app.post("/user/invite", (req, res) => {
  const { userId, invitedName, invitedAge, invitedEmail, invitedPhone } = req.body;

  if (!userId || !invitedName || !invitedAge || !invitedEmail || !invitedPhone) {
    return res.status(400).send("All fields are required.");
  }

  const checkInvitationsQuery = `SELECT invitationsLeft FROM USER WHERE id = ?`;

  db.get(checkInvitationsQuery, [userId], (err, user) => {
    if (err) return res.status(500).send("Error checking user invitations.");
    if (!user) return res.status(404).send("User not found.");
    if (user.invitationsLeft <= 0) return res.status(400).send("No invitations left.");

    const createInvitationQuery = `
      INSERT INTO INVITATIONS (userId, invitedName, invitedAge, invitedEmail, invitedPhone)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(createInvitationQuery, [userId, invitedName, invitedAge, invitedEmail, invitedPhone], function (err) {
      if (err) return res.status(500).send("Error creating invitation.");
      const updateInvitationsQuery = `UPDATE USER SET invitationsLeft = invitationsLeft - 1 WHERE id = ?`;
      db.run(updateInvitationsQuery, [userId], (err) => {
        if (err) return res.status(500).send("Error updating invitations count.");
        res.status(200).send({
          success: true,
          message: "Invitation sent successfully",
        });
      });
    });
  });
});

app.get("/user/:userId/invitations", (req, res) => {
  const { userId } = req.params;

  const checkInvitationsQuery = `SELECT invitationsLeft FROM USER WHERE id = ?`;

  db.get(checkInvitationsQuery, [userId], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error fetching invitations");
    }

    if (!user) {
      return res.status(404).send("User not found");
    }
    res.status(200).json({ invitationsLeft: user.invitationsLeft });
  });
});

app.post("/admin/class/add", (req, res) => {
  const { name, coachName, dayOfWeek, timeSlot, duration, availableSlots } = req.body;

  if (!name || !coachName || !dayOfWeek || !timeSlot || !duration) {
    return res.status(400).send("Name, coachName, dayOfWeek, timeSlot, and duration are required.");
  }

  const defaultAvailableSlots = 15;
  const query = `INSERT INTO CLASS (name, coachName, dayOfWeek, timeSlot, duration, availableSlots) VALUES (?, ?, ?, ?, ?, ?)`;

  db.run(query, [name, coachName, dayOfWeek, timeSlot, duration, availableSlots || defaultAvailableSlots], (err) => {
    if (err) return res.status(500).send("Error adding class");
    res.status(200).send("Class added successfully");
  });
});

app.put("/admin/class/edit", (req, res) => {
  const { classId, coachName, timeSlot, dayOfWeek } = req.body;

  if (!classId || !coachName || !timeSlot || !dayOfWeek) {
    return res
      .status(400)
      .send("All fields (classId, coachName, timeSlot, dayOfWeek) are required.");
  }

  const updateQuery = `
    UPDATE CLASS 
    SET coachName = ?, timeSlot = ?, dayOfWeek = ? 
    WHERE id = ?`;

  const getClassesQuery = `SELECT * FROM CLASS`;

  db.run(updateQuery, [coachName, timeSlot, dayOfWeek, classId], function (err) {
    if (err) {
      console.error("Error updating class:", err.message);
      return res.status(500).send("Error updating class in the database.");
    }

    db.all(getClassesQuery, [], (err, rows) => {
      if (err) {
        console.error("Error fetching updated classes:", err.message);
        return res.status(500).send("Error fetching updated classes.");
      }

      res.status(200).json({
        message: "Class updated successfully.",
        classes: rows,
      });
    });
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

app.post("/class/book", (req, res) => {
  const { userId, classId } = req.body;

  if (!userId || !classId) {
    return res.status(400).send("userId and classId are required.");
  }

  const checkBookingQuery = `SELECT * FROM BOOKINGS WHERE userId = ? AND classId = ?`;
  db.get(checkBookingQuery, [userId, classId], (err, booking) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error checking booking");
    }

    if (booking) {
      return res.status(400).send("User already booked for this class");
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
      db.run(bookQuery, [userId, classId], function (err) {
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

          res.status(200).send({ success: true, message: "Class booked successfully", bookingId: this.lastID });
        });
      });
    });
  });
});

app.get("/class/availability/:classId", (req, res) => {
  const { classId } = req.params;

  if (!classId) {
    return res.status(400).send("Class ID is required.");
  }

  const getAvailabilityQuery = `SELECT availableSlots FROM CLASS WHERE id = ?`;

  db.get(getAvailabilityQuery, [classId], (err, classInfo) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error fetching class availability.");
    }

    if (!classInfo) {
      return res.status(404).send("Class not found.");
    }

    res.status(200).send({
      success: true,
      classId,
      availableSlots: classInfo.availableSlots,
    });
  });
});

app.delete("/user/bookings/cancel/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  const getClassQuery = `SELECT classId FROM BOOKINGS WHERE id = ?`;
  db.get(getClassQuery, [bookingId], (err, booking) => {
    if (err) {
      console.error("Error retrieving booking:", err);
      return res.status(500).send("Error retrieving booking");
    }

    if (!booking) {
      return res.status(404).send("Booking not found");
    }

    const { classId } = booking;
    const deleteBookingQuery = `DELETE FROM BOOKINGS WHERE id = ?`;
    db.run(deleteBookingQuery, [bookingId], (err) => {
      if (err) {
        console.error("Error deleting booking:", err);
        return res.status(500).send("Error canceling booking");
      }
      const updateSlotsQuery = `UPDATE CLASS SET availableSlots = availableSlots + 1 WHERE id = ?`;
      db.run(updateSlotsQuery, [classId], (err) => {
        if (err) {
          console.error("Error updating available slots:", err);
          return res.status(500).send("Error updating available slots");
        }
        res.status(200).send("Booking canceled successfully");
      });
    });
  });
});

app.get("/user/bookings/:userId", (req, res) => {
  const userId = req.params.userId;
  const bookingsQuery = `SELECT * FROM BOOKINGS WHERE userId = ?`;
  db.all(bookingsQuery, [userId], (err, bookings) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error fetching booking history");
    }
    if (bookings.length === 0) {
      return res.status(404).send("No bookings found for this user");
    }
    const classesQuery = `SELECT * FROM CLASS`; 

    db.all(classesQuery, (err, classes) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error fetching class details");
      }
      const bookedClasses = bookings.map((booking) => {
        const bookedClass = classes.find((classItem) => classItem.id === booking.classId);
        if (bookedClass) {
          return {
            ...booking, 
            className: bookedClass.name,
            coachName: bookedClass.coachName,
            dayOfWeek: bookedClass.dayOfWeek,
            timeSlot: bookedClass.timeSlot,
            duration: bookedClass.duration,
          };
        }
        return null; 
      }).filter((classDetail) => classDetail !== null);
      res.status(200).json(bookedClasses);
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  db.serialize(() => {
    db.run(db_access.createUserTable);
    db.run(db_access.createClassTable);
    db.run(db_access.createBookingsTable);
    db.run(db_access.createInvitationsTable);
  });
});
