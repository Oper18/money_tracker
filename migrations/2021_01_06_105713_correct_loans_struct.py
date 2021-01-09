from orator.migrations import Migration


class CorrectLoansStruct(Migration):

    def up(self):
        """
        Run the migrations.
        """

        with self.schema.table('purchases') as table:
            table.integer('loan').nullable()
            table.integer('debt').nullable()

    def down(self):
        """
        Revert the migrations.
        """

        with self.schema.table('purchases') as table:
            table.drop_column('loan')
            table.drop_column('debt')
