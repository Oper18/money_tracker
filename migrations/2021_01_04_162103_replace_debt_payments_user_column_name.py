from orator.migrations import Migration


class ReplaceDebtPaymentsUserColumnName(Migration):

    def up(self):
        """
        Run the migrations.
        """

        with self.schema.table('debt_payments') as table:
            table.rename_column('user', 'user_id')

    def down(self):
        """
        Revert the migrations.
        """

        with self.schema.table('debt_payments') as table:
            table.rename_column('user_id', 'user')
