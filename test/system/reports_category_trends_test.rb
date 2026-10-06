require "application_system_test_case"

class ReportsCategoryTrendsTest < ApplicationSystemTestCase
  include EntriesTestHelper

  setup do
    @user = users(:family_admin)
    @user.update!(preferences: (@user.preferences || {}).merge("preview_features_enabled" => true))
    category = @user.family.categories.create!(name: "Trend Takeaways")
    6.times { |i| create_transaction(account: accounts(:depository), date: Date.current.beginning_of_month - i.months + 1.day, amount: 20 + i, category: category) }

    sign_in @user
    visit reports_path(period_type: :monthly)
  end

  test "each category gets a chart that reads out a month on hover and with the arrow keys" do
    within "section[data-section-key='category_trends']" do
      panel = find("[data-controller='category-trend'][aria-label^='Trend Takeaways']")
      assert panel.has_css?("svg path")

      panel.hover
    end
    assert_selector "[role='tooltip']", text: "Trend Takeaways ·"

    # Keyboard: focus reads the latest month, the left arrow steps back one.
    find("h1, h2", match: :first).hover
    panel = find("[data-controller='category-trend'][aria-label^='Trend Takeaways']")
    page.execute_script("arguments[0].focus()", panel)
    assert_selector "[role='tooltip']", text: I18n.l(Date.current.beginning_of_month, format: "%b %Y")
    panel.send_keys(:arrow_left)
    assert_selector "[role='tooltip']", text: I18n.l(Date.current.beginning_of_month - 1.month, format: "%b %Y")
  end
end
