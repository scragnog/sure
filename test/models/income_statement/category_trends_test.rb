require "test_helper"

class IncomeStatement::CategoryTrendsTest < ActiveSupport::TestCase
  include EntriesTestHelper

  setup do
    @family = families(:empty)
    @account = @family.accounts.create!(name: "Checking", currency: @family.currency, balance: 5000, accountable: Depository.new)
    @food = @family.categories.create!(name: "Food")
    @groceries = @family.categories.create!(name: "Groceries", parent: @food)
    @travel = @family.categories.create!(name: "Travel")
    @salary = @family.categories.create!(name: "Salary")
    @end_date = Date.new(2026, 9, 30)
  end

  test "covers the months up to the end date, oldest first" do
    trends = IncomeStatement::CategoryTrends.new(IncomeStatement.new(@family), end_date: @end_date, months: 3)

    assert_equal [ Date.new(2026, 7, 1), Date.new(2026, 8, 1), Date.new(2026, 9, 1) ], trends.months
    assert_not trends.partial_last_month?
  end

  test "monthly net spending per parent category, subcategories rolled up and refunds netted" do
    create_transaction(account: @account, date: Date.new(2026, 7, 4), amount: 100, category: @groceries)
    create_transaction(account: @account, date: Date.new(2026, 9, 4), amount: 80, category: @food)
    create_transaction(account: @account, date: Date.new(2026, 9, 6), amount: 50, category: @groceries)
    create_transaction(account: @account, date: Date.new(2026, 9, 8), amount: -30, category: @groceries) # refund
    create_transaction(account: @account, date: Date.new(2026, 8, 2), amount: 400, category: @travel)
    create_transaction(account: @account, date: Date.new(2026, 9, 1), amount: -3000, category: @salary)

    series = IncomeStatement::CategoryTrends.new(IncomeStatement.new(@family), end_date: @end_date, months: 3).series

    assert_equal [ "Travel", "Food" ], series.map { |s| s.category.name }
    food = series.find { |s| s.category == @food }
    assert_equal [ 100, 0, 100 ], food.values
    assert_equal 200, food.total
    assert_in_delta 66.67, food.average, 0.01
    assert_equal 100, food.peak
  end

  test "a mid-month end date makes the last month partial" do
    create_transaction(account: @account, date: Date.new(2026, 9, 20), amount: 60, category: @travel)

    trends = IncomeStatement::CategoryTrends.new(IncomeStatement.new(@family), end_date: Date.new(2026, 9, 15), months: 2)

    assert trends.partial_last_month?
    assert_empty trends.series, "spending after the end date is not counted"
  end
end
