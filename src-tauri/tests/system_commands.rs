use imageasy_lib::commands::system::{calculate_directory_size, clear_directory_contents};
use tempfile::tempdir;

#[test]
fn calculate_directory_size_sums_nested_files() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("a.bin"), [1u8, 2, 3]).unwrap();
    std::fs::create_dir(dir.path().join("nested")).unwrap();
    std::fs::write(dir.path().join("nested").join("b.bin"), [4u8, 5]).unwrap();

    assert_eq!(calculate_directory_size(dir.path()).unwrap(), 5);
}

#[test]
fn clear_directory_contents_removes_children_but_keeps_directory() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("a.bin"), [1u8]).unwrap();

    clear_directory_contents(dir.path()).unwrap();

    assert!(dir.path().is_dir());
    assert!(!dir.path().join("a.bin").exists());
}
