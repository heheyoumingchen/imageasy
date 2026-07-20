use imageasy_lib::commands::cancellation::{
    cancel_task, complete_task, register_task, token_for, CANCELLED_MESSAGE,
};

#[test]
fn cancel_task_makes_token_check_fail() {
    let id = format!("integration-cancel-{}", std::process::id());
    register_task(id.clone());
    let token = token_for(Some(&id)).expect("token");
    assert!(token.check().is_ok());
    assert!(cancel_task(id.clone()));
    let err = token.check().expect_err("should be cancelled");
    assert!(err.to_string().contains(CANCELLED_MESSAGE));
    complete_task(id);
}

#[test]
fn cancel_unknown_task_returns_false() {
    assert!(!cancel_task(format!("missing-{}", std::process::id())));
}
