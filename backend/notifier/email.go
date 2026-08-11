package notifier

import (
	"fmt"
	"net/mail"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
)

// constructNotificationEmails creates email notifications
// for users with due tasks.
func (n *Notifier) constructNotificationEmails(userSettings []*core.Record) []*EmailNotification {
	var notificationEmails []*EmailNotification

	for _, settings := range userSettings {
		remindEmail := settings.GetString("remindEmail")
		userID := settings.GetString("user")

		if remindEmail == "" {
			continue
		}

		userTasks, err := n.pb.FindRecordsByFilter(
			"tasks",
			fmt.Sprintf("user = '%s' && remindByEmail = true", userID),
			"",
			0,
			0,
		)
		if err != nil {
			n.pb.Logger().Error(
				"EMAIL reminder",
				"error", err.Error(),
				"email", remindEmail,
				"userId", userID,
			)
			continue
		}

		reminders := n.calculateDailyReminders(remindEmail, userID, userTasks)
		if len(reminders) == 0 {
			continue
		}

		notificationEmail, err := n.constructEmail(remindEmail, userID, reminders)
		if err != nil {
			n.pb.Logger().Error(
				"EMAIL reminder",
				"error", err.Error(),
				"email", remindEmail,
				"userId", userID,
			)
			continue
		}
		notificationEmails = append(notificationEmails, notificationEmail)
	}

	return notificationEmails
}

// constructEmail creates a notification email with reminders.
func (n *Notifier) constructEmail(emailAddress, userID string,
	reminders []TaskReminder) (*EmailNotification, error) {
	title := "Simple Data Center - 提醒"

	html, err := n.renderHTMLTemplate(reminders, title)
	if err != nil {
		return nil, err
	}

	message := &mailer.Message{
		From: mail.Address{
			Address: "noreply@simple-data-center",
			Name:    "Simple Data Center",
		},
		To:      []mail.Address{{Address: emailAddress}},
		Subject: title,
		HTML:    html,
	}

	emailNotification := &EmailNotification{
		emailAddress: emailAddress,
		userID:       userID,
		message:      message,
	}

	return emailNotification, nil
}

// sendEmails concurrently sends multiple email notifications using a worker pool.
// It logs success and failures, and is safe for concurrent use.
func (n *Notifier) sendEmails(emails []*EmailNotification) error {
	group := n.pool.NewGroup()

	for _, email := range emails {
		group.Submit(func() {
			if err := n.pb.NewMailClient().Send(email.message); err != nil {
				n.pb.Logger().Error(
					"EMAIL reminder",
					"error", err.Error(),
					"email", email.emailAddress,
					"userId", email.userID,
				)
			}
			n.pb.Logger().Info(
				"EMAIL reminder",
				"email", email.emailAddress,
				"userId", email.userID,
			)
		})
	}

	if err := group.Wait(); err != nil {
		return err
	}
	return nil
}
